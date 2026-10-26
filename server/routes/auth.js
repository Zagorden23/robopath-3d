import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { dbRepo } from '../db/database.js';
import {
  issueSessionTokens,
  clearSessionCookies,
  requireAuth,
} from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import {
  sendEmailOtp,
  sendSmsOtp,
  verifySmsOtp,
} from '../services/notificationService.js';

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  message: 'Too many authentication attempts. Please wait a minute and try again.',
});

const otpLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: 'Too many OTP verification requests. Please wait before trying again.',
});

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    preferences: user.preferences || {},
    exploredConcepts: user.exploredConcepts || ['ASTAR', 'EUCLIDEAN', 'DIFF_DRIVE'],
    completedDemos: user.completedDemos || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password cannot exceed 128 characters.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

function generateSixDigitOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function handleSignup(req, res) {
  try {
    const { name, email, password, confirmPassword, acceptTerms } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter your full name (at least 2 characters).',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        ok: false,
        error: 'Please provide a valid email address.',
      });
    }

    const pwdError = validatePasswordPolicy(password);
    if (pwdError) {
      return res.status(400).json({ ok: false, error: pwdError });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Passwords do not match.',
      });
    }

    if (acceptTerms === false) {
      return res.status(400).json({
        ok: false,
        error: 'You must acknowledge the academic platform terms to create an account.',
      });
    }

    const existing = await dbRepo.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: 'An account with this email address already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdUser = await dbRepo.createUser({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
    });

    const { csrfToken } = issueSessionTokens(res, createdUser, false);

    return res.status(201).json({
      ok: true,
      user: sanitizeUser(createdUser),
      csrfToken,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'Unable to complete registration.',
    });
  }
}

async function handleSignin(req, res) {
  try {
    const { email, password, rememberMe } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Email and password are required.',
      });
    }

    const user = await dbRepo.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid email or password.',
      });
    }

    const { csrfToken } = issueSessionTokens(
      res,
      user,
      Boolean(rememberMe)
    );

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(user),
      csrfToken,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Sign-in failed.',
    });
  }
}

async function handleSignout(req, res) {
  try {
    const cookieToken = req.cookies?.robopath_token;
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;
    const token = cookieToken || bearerToken;

    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const { getJwtSecret } = await import('../middleware/auth.js');
        const decoded = jwt.default.verify(token, getJwtSecret());
        const user = await dbRepo.findUserById(decoded.sub);
        if (user) {
          await dbRepo.updateUser(user.id, {
            tokenVersion: (user.tokenVersion ?? 1) + 1,
          });
        }
      } catch {
        // Ignore expired token on signout
      }
    }

    clearSessionCookies(res);
    return res.status(200).json({
      ok: true,
      message: 'Signed out and session invalidated.',
    });
  } catch {
    clearSessionCookies(res);
    return res.status(200).json({ ok: true });
  }
}

// Primary & Alias Auth Routes
router.post('/signup', authLimiter, handleSignup);
router.post('/register', authLimiter, handleSignup);
router.post('/signin', authLimiter, handleSignin);
router.post('/login', authLimiter, handleSignin);
router.post('/signout', handleSignout);
router.post('/logout', handleSignout);

// ============================================================================
// EMAIL OTP AUTHENTICATION
// ============================================================================
router.post('/email-otp/request', otpLimiter, async (req, res) => {
  try {
    const { email, name } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter a valid email address.',
      });
    }

    const existingOtp = await dbRepo.findOtpRecord(cleanEmail, 'email');
    const now = Date.now();
    if (
      existingOtp &&
      existingOtp.cooldownUntil &&
      now < existingOtp.cooldownUntil &&
      process.env.DISABLE_OTP_COOLDOWN !== 'true'
    ) {
      const waitSec = Math.ceil((existingOtp.cooldownUntil - now) / 1000);
      return res.status(429).json({
        ok: false,
        error: `Please wait ${waitSec}s before requesting another code.`,
        retryAfterSeconds: waitSec,
      });
    }

    const otpCode = generateSixDigitOtp();
    const otpHash = await bcrypt.hash(otpCode, 8);
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes
    const cooldownUntil = now + 30 * 1000; // 30s resend cooldown

    await dbRepo.upsertOtpRecord({
      identifier: cleanEmail,
      channel: 'email',
      otpHash,
      expiresAt,
      cooldownUntil,
    });

    // Ensure user exists or remember pending name
    const delivery = await sendEmailOtp(cleanEmail, otpCode, 'Email OTP Sign-In');

    return res.status(200).json({
      ok: true,
      email: cleanEmail,
      name: name ? String(name).trim() : undefined,
      expiresInSeconds: 300,
      cooldownSeconds: 30,
      deliveryProvider: delivery.provider,
      delivered: delivery.delivered,
      devCode: delivery.devCode,
      previewUrl: delivery.previewUrl || null,
      notice: delivery.notice,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'Failed to send email verification code.',
    });
  }
});

router.post('/email-otp/verify', otpLimiter, async (req, res) => {
  try {
    const { email, code, name } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({
        ok: false,
        error: 'Please provide your email and the 6-digit verification code.',
      });
    }

    const record = await dbRepo.findOtpRecord(cleanEmail, 'email');
    if (!record) {
      return res.status(400).json({
        ok: false,
        error: 'No active verification code found. Please request a new code.',
      });
    }

    if (Date.now() > record.expiresAt) {
      await dbRepo.deleteOtpRecord(cleanEmail, 'email');
      return res.status(400).json({
        ok: false,
        error: 'This verification code has expired. Please request a new code.',
      });
    }

    if ((record.attempts || 0) >= (record.maxAttempts || 5)) {
      await dbRepo.deleteOtpRecord(cleanEmail, 'email');
      return res.status(429).json({
        ok: false,
        error: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    const isValid = await bcrypt.compare(cleanCode, record.otpHash);
    if (!isValid) {
      const updatedRec = await dbRepo.incrementOtpAttempts(cleanEmail, 'email');
      const remaining = Math.max(
        0,
        (updatedRec?.maxAttempts || 5) - (updatedRec?.attempts || 1)
      );
      return res.status(401).json({
        ok: false,
        error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining,
      });
    }

    // One-time use: delete OTP immediately after verification
    await dbRepo.deleteOtpRecord(cleanEmail, 'email');

    let user = await dbRepo.findUserByEmail(cleanEmail);
    if (!user) {
      const defaultName =
        name && String(name).trim().length >= 2
          ? String(name).trim()
          : cleanEmail.split('@')[0].slice(0, 40) || 'Robotics Researcher';
      const randomPwdHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      user = await dbRepo.createUser({
        name: defaultName,
        email: cleanEmail,
        passwordHash: randomPwdHash,
        emailVerified: true,
      });
    } else if (!user.emailVerified) {
      user = await dbRepo.updateUser(user.id, { emailVerified: true });
    }

    const { csrfToken } = issueSessionTokens(res, user, false);

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(user),
      csrfToken,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Email OTP verification failed.',
    });
  }
});

// ============================================================================
// PHONE-NUMBER SMS OTP AUTHENTICATION
// ============================================================================
function normalizeInternationalPhone(countryCode, phoneNumber) {
  const raw = String(phoneNumber || '').trim();
  const cc = String(countryCode || '+1').trim();
  const combined = raw.startsWith('+') ? raw : `${cc.startsWith('+') ? cc : `+${cc}`}${raw.replace(/\D/g, '')}`;
  const parsed = parsePhoneNumberFromString(combined);
  if (parsed && parsed.isValid()) {
    return parsed.number; // E.164 format e.g. +14155552671
  }
  // Fallback strict E.164 pattern check for test/academic numbers
  if (/^\+[1-9]\d{7,14}$/.test(combined)) {
    return combined;
  }
  return null;
}

router.post('/phone-otp/request', otpLimiter, async (req, res) => {
  try {
    const { countryCode = '+1', phoneNumber, name } = req.body || {};
    const phoneE164 = normalizeInternationalPhone(countryCode, phoneNumber);

    if (!phoneE164) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter a valid international phone number.',
      });
    }

    const existingOtp = await dbRepo.findOtpRecord(phoneE164, 'phone');
    const now = Date.now();
    if (
      existingOtp &&
      existingOtp.cooldownUntil &&
      now < existingOtp.cooldownUntil &&
      process.env.DISABLE_OTP_COOLDOWN !== 'true'
    ) {
      const waitSec = Math.ceil((existingOtp.cooldownUntil - now) / 1000);
      return res.status(429).json({
        ok: false,
        error: `Please wait ${waitSec}s before requesting another SMS code.`,
        retryAfterSeconds: waitSec,
      });
    }

    const otpCode = generateSixDigitOtp();
    const otpHash = await bcrypt.hash(otpCode, 8);
    const expiresAt = now + 5 * 60 * 1000;
    const cooldownUntil = now + 30 * 1000;

    const delivery = await sendSmsOtp(phoneE164, otpCode);

    await dbRepo.upsertOtpRecord({
      identifier: phoneE164,
      channel: 'phone',
      otpHash: delivery.provider === 'twilio-verify' ? null : otpHash,
      provider: delivery.provider === 'twilio-verify' ? 'twilio-verify' : 'local',
      expiresAt,
      cooldownUntil,
    });

    return res.status(200).json({
      ok: true,
      phone: phoneE164,
      name: name ? String(name).trim() : undefined,
      expiresInSeconds: 300,
      cooldownSeconds: 30,
      deliveryProvider: delivery.provider,
      delivered: delivery.delivered,
      devCode: delivery.devCode,
      notice: delivery.notice,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'Failed to send SMS verification code.',
    });
  }
});

router.post('/phone-otp/verify', otpLimiter, async (req, res) => {
  try {
    const { countryCode = '+1', phoneNumber, phone, code, name } = req.body || {};
    const phoneE164 = phone
      ? normalizeInternationalPhone('', phone)
      : normalizeInternationalPhone(countryCode, phoneNumber);
    const cleanCode = String(code || '').trim();

    if (!phoneE164 || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({
        ok: false,
        error: 'Please provide a valid phone number and the 6-digit SMS code.',
      });
    }

    const record = await dbRepo.findOtpRecord(phoneE164, 'phone');
    if (!record) {
      return res.status(400).json({
        ok: false,
        error: 'No active SMS verification code found. Please request a new code.',
      });
    }

    if (Date.now() > record.expiresAt) {
      await dbRepo.deleteOtpRecord(phoneE164, 'phone');
      return res.status(400).json({
        ok: false,
        error: 'This SMS verification code has expired. Please request a new code.',
      });
    }

    if ((record.attempts || 0) >= (record.maxAttempts || 5)) {
      await dbRepo.deleteOtpRecord(phoneE164, 'phone');
      return res.status(429).json({
        ok: false,
        error: 'Maximum SMS verification attempts exceeded. Please request a new code.',
      });
    }

    const isValid =
      record.provider === 'twilio-verify'
        ? await verifySmsOtp(phoneE164, cleanCode)
        : await bcrypt.compare(cleanCode, record.otpHash);
    if (!isValid) {
      const updatedRec = await dbRepo.incrementOtpAttempts(phoneE164, 'phone');
      const remaining = Math.max(
        0,
        (updatedRec?.maxAttempts || 5) - (updatedRec?.attempts || 1)
      );
      return res.status(401).json({
        ok: false,
        error: `Invalid SMS verification code. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining,
      });
    }

    await dbRepo.deleteOtpRecord(phoneE164, 'phone');

    let user = await dbRepo.findUserByPhone(phoneE164);
    if (!user) {
      const defaultName =
        name && String(name).trim().length >= 2
          ? String(name).trim()
          : `Operator ${phoneE164.slice(-4)}`;
      const syntheticEmail = `phone_${phoneE164.replace(/\D/g, '')}@mobile.robopath.edu`;
      const randomPwdHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      user = await dbRepo.createUser({
        name: defaultName,
        email: syntheticEmail,
        phone: phoneE164,
        phoneVerified: true,
        passwordHash: randomPwdHash,
      });
    } else if (!user.phoneVerified) {
      user = await dbRepo.updateUser(user.id, { phoneVerified: true });
    }

    const { csrfToken } = issueSessionTokens(res, user, false);

    return res.status(200).json({
      ok: true,
      user: sanitizeUser(user),
      csrfToken,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'Phone OTP verification failed.',
    });
  }
});

// ============================================================================
// FORGOT PASSWORD & RESET PASSWORD WORKFLOWS
// ============================================================================
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter a valid email address.',
      });
    }

    const user = await dbRepo.findUserByEmail(cleanEmail);
    if (!user) {
      // Return generic success message to prevent account enumeration
      return res.status(200).json({
        ok: true,
        message: 'If an account exists for that email, a 6-digit password reset code has been sent.',
      });
    }

    const resetCode = generateSixDigitOtp();
    const tokenHash = await bcrypt.hash(resetCode, 8);
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    await dbRepo.upsertPasswordReset({
      email: cleanEmail,
      tokenHash,
      expiresAt,
    });

    const delivery = await sendEmailOtp(cleanEmail, resetCode, 'Password Reset');

    return res.status(200).json({
      ok: true,
      message: 'Password reset code generated.',
      expiresInSeconds: 900,
      deliveryProvider: delivery.provider,
      delivered: delivery.delivered,
      devCode: delivery.devCode,
      previewUrl: delivery.previewUrl || null,
      notice: delivery.notice,
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message || 'Unable to process password reset request.',
    });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();

    if (!cleanEmail || !cleanCode || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Email, reset code, and new password are required.',
      });
    }

    const pwdErr = validatePasswordPolicy(newPassword);
    if (pwdErr) {
      return res.status(400).json({ ok: false, error: pwdErr });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Passwords do not match.',
      });
    }

    const resetRecord = await dbRepo.findPasswordReset(cleanEmail);
    if (!resetRecord || Date.now() > resetRecord.expiresAt) {
      await dbRepo.deletePasswordReset(cleanEmail);
      return res.status(400).json({
        ok: false,
        error: 'Invalid or expired password reset code.',
      });
    }

    const isMatch = await bcrypt.compare(cleanCode, resetRecord.tokenHash);
    if (!isMatch) {
      return res.status(401).json({
        ok: false,
        error: 'Incorrect password reset code.',
      });
    }

    const user = await dbRepo.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'Account not found.',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await dbRepo.updateUser(user.id, {
      passwordHash: newHash,
      tokenVersion: (user.tokenVersion ?? 1) + 1,
    });
    await dbRepo.deletePasswordReset(cleanEmail);

    return res.status(200).json({
      ok: true,
      message: 'Password updated successfully. You may now sign in with your new password.',
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || 'Unable to reset password.',
    });
  }
});

// ============================================================================
// SESSION & PROFILE ENDPOINTS
// ============================================================================
router.get('/me', requireAuth, async (req, res) => {
  return res.status(200).json({
    ok: true,
    user: sanitizeUser(req.user),
    csrfToken: req.csrfToken,
  });
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, preferences, exploredConcepts, completedDemos } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (cleanName.length < 2 || cleanName.length > 80) {
        return res.status(400).json({
          ok: false,
          error: 'Name must be between 2 and 80 characters.',
        });
      }
      updates.name = cleanName;
    }

    if (preferences && typeof preferences === 'object') {
      updates.preferences = {
        ...(req.user.preferences || {}),
        ...preferences,
      };
    }

    if (Array.isArray(exploredConcepts)) {
      updates.exploredConcepts = Array.from(
        new Set(exploredConcepts.map((c) => String(c)))
      );
    }

    if (Array.isArray(completedDemos)) {
      updates.completedDemos = Array.from(
        new Set(completedDemos.map((d) => String(d)))
      );
    }

    const updated = await dbRepo.updateUser(req.user.id, updates);
    return res.status(200).json({
      ok: true,
      user: sanitizeUser(updated),
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      error: err.message || 'Unable to update profile.',
    });
  }
});

export default router;
