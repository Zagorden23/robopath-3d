import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { dbRepo } from '../db/database.js';

const RUNTIME_FALLBACK_SECRET = crypto.randomBytes(48).toString('hex');

export function getJwtSecret() {
  const configuredSecret = process.env.JWT_SECRET || '';
  if (
    process.env.NODE_ENV === 'production' &&
    (configuredSecret.length < 32 ||
      configuredSecret.includes('replace_with_') ||
      configuredSecret.includes('secure_random_'))
  ) {
    throw new Error(
      'JWT_SECRET must be a unique production secret of at least 32 characters.'
    );
  }
  return configuredSecret || RUNTIME_FALLBACK_SECRET;
}

export function issueSessionTokens(res, user, rememberMe = false) {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const expiresIn = rememberMe ? '30d' : process.env.JWT_EXPIRES_IN || '7d';
  const maxAgeMs = rememberMe
    ? 30 * 24 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;

  const accessToken = jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 1,
      csrfToken,
    },
    getJwtSecret(),
    { expiresIn }
  );

  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('robopath_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });

  res.cookie('robopath_csrf', csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });

  return { csrfToken };
}

export function clearSessionCookies(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('robopath_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie('robopath_csrf', {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
}

export async function requireAuth(req, res, next) {
  try {
    const cookieToken = req.cookies?.robopath_token;
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    const token = cookieToken || bearerToken;
    if (!token) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication required. Please sign in to continue.',
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    // When authenticated via browser HttpOnly cookie, enforce CSRF token verification on mutating requests
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (cookieToken && !bearerToken && isMutating) {
      const headerCsrf = req.headers['x-csrf-token'];
      if (!headerCsrf || headerCsrf !== decoded.csrfToken) {
        return res.status(403).json({
          ok: false,
          error: 'Invalid or missing CSRF security token.',
        });
      }
    }

    const user = await dbRepo.findUserById(decoded.sub);
    if (!user) {
      clearSessionCookies(res);
      return res.status(401).json({
        ok: false,
        error: 'User account no longer exists.',
      });
    }

    if ((user.tokenVersion ?? 1) !== (decoded.tokenVersion ?? 1)) {
      clearSessionCookies(res);
      return res.status(401).json({
        ok: false,
        error: 'Session has been invalidated. Please sign in again.',
      });
    }

    req.user = user;
    req.csrfToken = decoded.csrfToken;
    return next();
  } catch {
    clearSessionCookies(res);
    return res.status(401).json({
      ok: false,
      error: 'Invalid or expired authentication session.',
    });
  }
}
