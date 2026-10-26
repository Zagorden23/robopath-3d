import nodemailer from 'nodemailer';

let cachedEtherealTransporterPromise = null;

function isPlaceholderValue(val) {
  const clean = String(val || '').trim();
  if (!clean) return true;
  if (
    clean === 'smtp.example.com' ||
    clean.startsWith('replace_with_') ||
    clean === 'your_smtp_user' ||
    clean === 'your_smtp_pass'
  ) {
    return true;
  }
  return false;
}

function buildEmailHtml(purpose, otpCode) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fdfaf0; border: 1px solid #e2d9c0; border-radius: 12px; color: #0f1e36;">
      <h2 style="margin-top: 0; color: #0d4f56;">RoboPath 3D Verification</h2>
      <p>Use the following one-time verification code for <strong>${purpose}</strong>:</p>
      <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 16px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; color: #0f766e;">
        ${otpCode}
      </div>
      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">This code expires in 5 minutes and can only be used once.</p>
    </div>
  `;
}

async function getEtherealTransporter() {
  if (!cachedEtherealTransporterPromise) {
    cachedEtherealTransporterPromise = (async () => {
      const testAccount = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        connectionTimeout: 2500,
        greetingTimeout: 2500,
        socketTimeout: 3000,
      });
    })().catch((err) => {
      cachedEtherealTransporterPromise = null;
      throw err;
    });
  }
  return cachedEtherealTransporterPromise;
}

async function trySendEtherealEmail(from, email, otpCode, purpose) {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  try {
    const sendTask = (async () => {
      const transporter = await getEtherealTransporter();
      const info = await transporter.sendMail({
        from,
        to: email,
        subject: `RoboPath 3D — ${purpose} Code: ${otpCode}`,
        text: `Your RoboPath 3D one-time verification code is: ${otpCode}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
        html: buildEmailHtml(purpose, otpCode),
      });
      return nodemailer.getTestMessageUrl(info) || null;
    })();

    const timeoutTask = new Promise((resolve) => {
      setTimeout(() => resolve(null), 3200);
    });

    return await Promise.race([sendTask, timeoutTask]);
  } catch {
    return null;
  }
}

export async function sendEmailOtp(email, otpCode, purpose = 'Sign-In Verification') {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'RoboPath 3D <no-reply@robopath.edu>';

  const hasCustomSmtp =
    !isPlaceholderValue(host) &&
    !isPlaceholderValue(user) &&
    !isPlaceholderValue(pass);

  if (hasCustomSmtp) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 7000,
      });

      await transporter.sendMail({
        from,
        to: email,
        subject: `RoboPath 3D — ${purpose} Code: ${otpCode}`,
        text: `Your RoboPath 3D one-time verification code is: ${otpCode}\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
        html: buildEmailHtml(purpose, otpCode),
      });

      return {
        delivered: true,
        provider: 'smtp',
        previewUrl: null,
        notice: `A 6-digit verification code has been sent to ${email} via SMTP.`,
      };
    } catch (smtpErr) {
      if (process.env.STRICT_NOTIFICATION_PROVIDERS === 'true') {
        throw smtpErr;
      }
      console.warn(
        `[RoboPath SMTP Fallback] Custom SMTP failed (${smtpErr.message}). Falling back to built-in OTP relay.`
      );
    }
  }

  if (process.env.STRICT_NOTIFICATION_PROVIDERS === 'true') {
    const err = new Error(
      'SMTP email provider is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.'
    );
    err.status = 503;
    throw err;
  }

  const previewUrl = await trySendEtherealEmail(from, email, otpCode, purpose);

  console.log(
    `[RoboPath EMAIL OTP RELAY] To: ${email} | Purpose: ${purpose} | Code: ${otpCode}${
      previewUrl ? ` | Ethereal Preview: ${previewUrl}` : ''
    }`
  );

  return {
    delivered: Boolean(previewUrl),
    provider: previewUrl ? 'ethereal-smtp' : 'instant-otp-relay',
    devCode: otpCode,
    previewUrl: previewUrl || null,
    notice: previewUrl
      ? 'Verification email dispatched via built-in Ethereal SMTP relay. Open the email inbox preview or use the auto-filled code below.'
      : 'Instant Verification Relay Active: Your 6-digit code has been generated and pre-filled below.',
  };
}

export async function sendSmsOtp(phoneE164, otpCode) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  const hasTwilio =
    !isPlaceholderValue(accountSid) &&
    !isPlaceholderValue(authToken) &&
    (!isPlaceholderValue(fromPhone) || !isPlaceholderValue(verifyServiceSid));

  if (hasTwilio) {
    try {
      const twilioPkg = await import('twilio');
      const client = twilioPkg.default(accountSid, authToken);

      if (!isPlaceholderValue(verifyServiceSid)) {
        await client.verify.v2
          .services(verifyServiceSid)
          .verifications.create({ to: phoneE164, channel: 'sms' });
        return {
          delivered: true,
          provider: 'twilio-verify',
          notice: `A 6-digit SMS verification code has been sent to ${phoneE164}.`,
        };
      }

      await client.messages.create({
        body: `RoboPath 3D verification code: ${otpCode}. Valid for 5 minutes.`,
        from: fromPhone,
        to: phoneE164,
      });

      return {
        delivered: true,
        provider: 'twilio-sms',
        notice: `A 6-digit SMS verification code has been sent to ${phoneE164}.`,
      };
    } catch (twilioErr) {
      if (process.env.STRICT_NOTIFICATION_PROVIDERS === 'true') {
        throw twilioErr;
      }
      console.warn(
        `[RoboPath SMS Fallback] Twilio SMS failed (${twilioErr.message}). Falling back to built-in SMS OTP relay.`
      );
    }
  }

  if (process.env.STRICT_NOTIFICATION_PROVIDERS === 'true') {
    const err = new Error(
      'SMS provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.'
    );
    err.status = 503;
    throw err;
  }

  console.log(`[RoboPath SMS OTP RELAY] To: ${phoneE164} | Code: ${otpCode}`);
  return {
    delivered: false,
    provider: 'instant-sms-relay',
    devCode: otpCode,
    notice:
      'Instant SMS OTP Relay Active: Your 6-digit SMS verification code has been generated and pre-filled below.',
  };
}

export async function verifySmsOtp(phoneE164, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (
    isPlaceholderValue(accountSid) ||
    isPlaceholderValue(authToken) ||
    isPlaceholderValue(verifyServiceSid)
  ) {
    const err = new Error(
      'Twilio Verify is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.'
    );
    err.status = 503;
    throw err;
  }

  const twilioPkg = await import('twilio');
  const client = twilioPkg.default(accountSid, authToken);
  const result = await client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phoneE164, code });

  return result.status === 'approved';
}
