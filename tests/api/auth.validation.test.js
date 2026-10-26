import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_STORE_PATH = path.resolve(__dirname, '../../.data/test-auth-store.json');

// Configure test environment before importing app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'robopath-test-jwt-secret-key-32bytes-secure!';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.FORCE_LOCAL_STORE = 'true';
process.env.ROBOPATH_STORE_PATH = TEST_STORE_PATH;

const { app } = await import('../../server/app.js');
const { clearLocalStoreForTests } = await import('../../server/db/database.js');

describe('Auth & Input Validation API', () => {
  beforeEach(() => {
    clearLocalStoreForTests();
  });

  afterAll(() => {
    if (fs.existsSync(TEST_STORE_PATH)) {
      try {
        fs.unlinkSync(TEST_STORE_PATH);
      } catch {
        // cleanup ignore
      }
    }
  });

  describe('POST /api/auth/signup - Validation', () => {
    it('rejects signup with missing name', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'alice@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/name/i);
    });

    it('rejects signup with name shorter than 2 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: ' A ',
          email: 'alice@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/at least 2 characters/i);
    });

    it('rejects signup with invalid email formats', async () => {
      const invalidEmails = [
        'plainaddress',
        '@missinguser.com',
        'missingdomain@.com',
        'spaces in@email.com',
        'user@domain',
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/auth/signup')
          .send({
            name: 'Valid Name',
            email,
            password: 'Password123',
          });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/valid email/i);
      }
    });

    it('rejects passwords shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Robotics',
          email: 'alice@example.com',
          password: 'Pass1',
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/at least 8 characters/i);
    });

    it('rejects passwords longer than 128 characters', async () => {
      const longPassword = 'A1' + 'a'.repeat(130);
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Robotics',
          email: 'alice@example.com',
          password: longPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/cannot exceed 128 characters/i);
    });

    it('rejects passwords missing letters or numbers', async () => {
      // Numbers only
      const res1 = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Robotics',
          email: 'alice@example.com',
          password: '1234567890',
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/at least one letter and one number/i);

      // Letters only
      const res2 = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Robotics',
          email: 'alice@example.com',
          password: 'JustLettersPassword',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/at least one letter and one number/i);
    });

    it('rejects password confirmation mismatch', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Robotics',
          email: 'alice@example.com',
          password: 'Password123',
          confirmPassword: 'PasswordMismatch999',
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/passwords do not match/i);
    });

    it('rejects signup when academic terms are explicitly rejected', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alice Robotics',
          email: 'alice@example.com',
          password: 'Password123',
          acceptTerms: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/terms/i);
    });

    it('successfully registers valid user and returns sanitized user with cookies', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: '  Ada Lovelace  ',
          email: '  Ada.Lovelace@RoboPath.edu  ',
          password: 'PioneeringAlgorithm1843',
          confirmPassword: 'PioneeringAlgorithm1843',
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe('Ada Lovelace');
      expect(res.body.user.email).toBe('ada.lovelace@robopath.edu');
      expect(res.body.user.passwordHash).toBeUndefined(); // Security: never leak password hash
      expect(res.body.token).toBeUndefined(); // Session token stays in the HttpOnly cookie.
      expect(res.body.csrfToken).toBeDefined();

      // Check cookie headers
      const cookies = res.headers['set-cookie'] || [];
      const tokenCookie = cookies.find((c) => c.startsWith('robopath_token='));
      const csrfCookie = cookies.find((c) => c.startsWith('robopath_csrf='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
      expect(csrfCookie).toBeDefined();
    });

    it('rejects duplicate email signup with 409 Conflict', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Original User',
          email: 'duplicate@robopath.edu',
          password: 'Password123',
        });

      const duplicateRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Duplicate Attempt',
          email: 'DUPLICATE@robopath.edu', // Case insensitive check
          password: 'Password456',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.ok).toBe(false);
      expect(duplicateRes.body.error).toMatch(/already exists/i);
    });
  });

  describe('POST /api/auth/signin - Validation', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Alan Turing',
          email: 'alan@robopath.edu',
          password: 'EnigmaPassword1940',
        });
    });

    it('rejects signin with missing email or password', async () => {
      const res1 = await request(app)
        .post('/api/auth/signin')
        .send({ password: 'EnigmaPassword1940' });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/email and password are required/i);

      const res2 = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'alan@robopath.edu' });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/email and password are required/i);
    });

    it('rejects signin with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'unknown@robopath.edu',
          password: 'EnigmaPassword1940',
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('rejects signin with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'alan@robopath.edu',
          password: 'WrongPassword999',
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('successfully signs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'ALAN@robopath.edu', // lowercased properly
          password: 'EnigmaPassword1940',
          rememberMe: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.email).toBe('alan@robopath.edu');
      expect(res.body.token).toBeUndefined();
      expect(res.body.csrfToken).toBeDefined();

      const cookies = res.headers['set-cookie'] || [];
      expect(cookies.some((c) => c.startsWith('robopath_token='))).toBe(true);
    });
  });

  describe('PUT /api/auth/profile - Validation', () => {
    let cookieHeader = '';
    let csrfToken = '';

    beforeEach(async () => {
      const signup = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Claude Shannon',
          email: 'claude@robopath.edu',
          password: 'EntropyPassword1948',
        });
      csrfToken = signup.body.csrfToken;
      cookieHeader = (signup.headers['set-cookie'] || [])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
    });

    it('rejects profile update without authorization header', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'New Name' });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });

    it('rejects name shorter than 2 characters or longer than 80 characters', async () => {
      const shortRes = await request(app)
        .put('/api/auth/profile')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'A' });

      expect(shortRes.status).toBe(400);
      expect(shortRes.body.error).toMatch(/between 2 and 80 characters/i);

      const longRes = await request(app)
        .put('/api/auth/profile')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ name: 'X'.repeat(81) });

      expect(longRes.status).toBe(400);
      expect(longRes.body.error).toMatch(/between 2 and 80 characters/i);
    });

    it('successfully updates user preferences and learning progress', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          name: 'Claude E. Shannon',
          preferences: {
            defaultAlgorithm: 'RRT',
            renderQuality: 'performance',
          },
          exploredConcepts: ['ASTAR', 'RRT', 'CSPACE'],
          completedDemos: ['demo-narrow-passage'],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.name).toBe('Claude E. Shannon');
      expect(res.body.user.preferences.defaultAlgorithm).toBe('RRT');
      expect(res.body.user.preferences.renderQuality).toBe('performance');
      expect(res.body.user.exploredConcepts).toContain('CSPACE');
      expect(res.body.user.completedDemos).toContain('demo-narrow-passage');
    });
  });

  describe('Email OTP, Phone OTP, Password Reset & Results CSV Export', () => {
    it('completes Email OTP request and verification flow', async () => {
      const reqRes = await request(app)
        .post('/api/auth/email-otp/request')
        .send({ email: 'otpuser@robopath.edu' });

      expect(reqRes.status).toBe(200);
      expect(reqRes.body.ok).toBe(true);
      expect(reqRes.body.devCode).toMatch(/^\d{6}$/);

      const verifyRes = await request(app)
        .post('/api/auth/email-otp/verify')
        .send({
          email: 'otpuser@robopath.edu',
          code: reqRes.body.devCode,
          name: 'OTP Researcher',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.ok).toBe(true);
      expect(verifyRes.body.user.email).toBe('otpuser@robopath.edu');
      expect(verifyRes.body.user.emailVerified).toBe(true);
      expect(verifyRes.body.token).toBeUndefined();
    });

    it('completes Phone OTP request and verification flow', async () => {
      const reqRes = await request(app)
        .post('/api/auth/phone-otp/request')
        .send({ countryCode: '+1', phoneNumber: '4155552671' });

      expect(reqRes.status).toBe(200);
      expect(reqRes.body.ok).toBe(true);
      expect(reqRes.body.devCode).toMatch(/^\d{6}$/);

      const verifyRes = await request(app)
        .post('/api/auth/phone-otp/verify')
        .send({
          countryCode: '+1',
          phoneNumber: '4155552671',
          code: reqRes.body.devCode,
          name: 'Mobile Roboticist',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.ok).toBe(true);
      expect(verifyRes.body.user.phoneVerified).toBe(true);
      expect(verifyRes.body.token).toBeUndefined();
    });

    it('completes Forgot Password and Reset Password flow', async () => {
      await request(app).post('/api/auth/signup').send({
        name: 'Reset User',
        email: 'reset@robopath.edu',
        password: 'OldPassword123',
      });

      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@robopath.edu' });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.ok).toBe(true);
      expect(forgotRes.body.devCode).toMatch(/^\d{6}$/);

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'reset@robopath.edu',
          code: forgotRes.body.devCode,
          newPassword: 'NewSecurePassword456',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.ok).toBe(true);

      const loginRes = await request(app).post('/api/auth/signin').send({
        email: 'reset@robopath.edu',
        password: 'NewSecurePassword456',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.ok).toBe(true);
    });

    it('records simulation results and exports valid CSV', async () => {
      const signup = await request(app).post('/api/auth/signup').send({
        name: 'Experiment User',
        email: 'exp@robopath.edu',
        password: 'ExperimentPass123',
      });
      const csrfToken = signup.body.csrfToken;
      const cookieHeader = (signup.headers['set-cookie'] || [])
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

      const postRes = await request(app)
        .post('/api/results')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({
          scenarioId: 'maze',
          scenarioName: 'Maze Navigation',
          planner: 'ASTAR',
          heuristic: 'octile',
          movementMode: '8-dir',
          pathFound: true,
          resultStatus: 'PATH_FOUND',
          pathLength: 18.42,
          pathCost: 18.42,
          nodesExpanded: 64,
          planningTimeMs: 2.15,
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.ok).toBe(true);
      expect(postRes.body.result.planner).toBe('ASTAR');

      const csvRes = await request(app)
        .get('/api/results/export/csv')
        .set('Cookie', cookieHeader);

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toMatch(/text\/csv/);
      expect(csvRes.text).toContain(
        'runId,scenarioId,planner,heuristic,movementMode,pathFound,resultStatus,pathLength,nodesExpanded,planningTimeMs,timestamp'
      );
      expect(csvRes.text).toContain('ASTAR');
    });
  });
});
