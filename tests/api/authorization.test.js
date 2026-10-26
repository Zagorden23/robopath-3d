import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_STORE_PATH = path.resolve(__dirname, '../../.data/test-authz-store.json');

const TEST_SECRET = 'robopath-test-jwt-secret-key-32bytes-secure!';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = TEST_SECRET;
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.FORCE_LOCAL_STORE = 'true';
process.env.ROBOPATH_STORE_PATH = TEST_STORE_PATH;

const { app } = await import('../../server/app.js');
const { clearLocalStoreForTests, dbRepo } = await import('../../server/db/database.js');

describe('Authorization & Multi-Tenant Access Control API', () => {
  let userA = null;
  let tokenA = '';
  let csrfA = '';
  let cookieHeaderA = '';

  let userB = null;
  let tokenB = '';
  let csrfB = '';

  beforeEach(async () => {
    clearLocalStoreForTests();

    // Register User A
    const resA = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'User Alpha',
        email: 'alpha@robopath.edu',
        password: 'PasswordAlpha123',
      });
    userA = resA.body.user;
    tokenA = jwt.sign(
      { sub: userA.id, email: userA.email, tokenVersion: 1 },
      TEST_SECRET,
      { expiresIn: '1h' }
    );
    csrfA = resA.body.csrfToken;
    const cookiesA = resA.headers['set-cookie'] || [];
    cookieHeaderA = cookiesA.map((c) => c.split(';')[0]).join('; ');

    // Register User B
    const resB = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'User Beta',
        email: 'beta@robopath.edu',
        password: 'PasswordBeta456',
      });
    userB = resB.body.user;
    tokenB = jwt.sign(
      { sub: userB.id, email: userB.email, tokenVersion: 1 },
      TEST_SECRET,
      { expiresIn: '1h' }
    );
    csrfB = resB.body.csrfToken;
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

  describe('JWT Authentication Middleware (requireAuth)', () => {
    it('returns 401 when no token or cookie is supplied', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Authentication required/i);
    });

    it('returns 401 when token is malformed', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer totally-invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid or expired authentication session/i);
    });

    it('returns 401 when token is signed with wrong secret', async () => {
      const bogusToken = jwt.sign(
        { sub: userA.id, email: userA.email },
        'wrong-secret-key-attacker',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${bogusToken}`);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid or expired authentication session/i);
    });

    it('returns 401 when user in token no longer exists in database', async () => {
      const orphanedToken = jwt.sign(
        { sub: 'non-existent-user-id-999', email: 'ghost@robopath.edu', tokenVersion: 1 },
        TEST_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${orphanedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/no longer exists/i);
    });

    it('returns 401 when user session has been invalidated (signout/tokenVersion increment)', async () => {
      // User A signs out
      await request(app)
        .post('/api/auth/signout')
        .set('Authorization', `Bearer ${tokenA}`);

      // Attempting to use old token
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Session has been invalidated/i);
    });

    it('authenticates successfully via Bearer header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.id).toBe(userA.id);
      expect(res.body.user.email).toBe(userA.email);
    });

    it('authenticates successfully via HttpOnly cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookieHeaderA);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.id).toBe(userA.id);
    });
  });

  describe('CSRF Protection on Cookie Sessions', () => {
    const validScenarioPayload = {
      name: 'CSRF Test Scenario',
      environment: {
        width: 20,
        depth: 20,
        start: { x: 2, z: 2 },
        goal: { x: 18, z: 18 },
      },
    };

    it('rejects mutating cookie request when x-csrf-token header is missing', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Cookie', cookieHeaderA)
        .send(validScenarioPayload);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid or missing CSRF security token/i);
    });

    it('rejects mutating cookie request when x-csrf-token header does not match', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Cookie', cookieHeaderA)
        .set('x-csrf-token', 'wrong-mismatched-csrf-token')
        .send(validScenarioPayload);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid or missing CSRF security token/i);
    });

    it('permits mutating cookie request when valid x-csrf-token header is present', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Cookie', cookieHeaderA)
        .set('x-csrf-token', csrfA)
        .send(validScenarioPayload);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.scenario.name).toBe('CSRF Test Scenario');
    });

    it('permits mutating requests with Bearer token without requiring x-csrf-token', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(validScenarioPayload);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.scenario.name).toBe('CSRF Test Scenario');
    });
  });

  describe('Scenario Multi-Tenant Ownership & Authorization', () => {
    let scenarioA = null;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Alpha Warehouse Navigation',
          description: 'A test navigation scenario for Alpha',
          environment: {
            width: 20,
            depth: 20,
            start: { x: 1, z: 1 },
            goal: { x: 10, z: 10 },
          },
        });
      scenarioA = res.body.scenario;
    });

    it('enforces ownerId to match authenticated caller even if spoofed in payload', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          ownerId: 'spoofed-fake-owner-id',
          name: 'Spoof Attempt',
          environment: {
            width: 20,
            depth: 20,
            start: { x: 0, z: 0 },
            goal: { x: 5, z: 5 },
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.scenario.ownerId).toBe(userA.id);
    });

    it('allows owner to fetch their own scenario', async () => {
      const res = await request(app)
        .get(`/api/scenarios/${scenarioA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.scenario.id).toBe(scenarioA.id);
    });

    it('forbids User B from reading User A’s scenario (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/scenarios/${scenarioA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it('forbids User B from modifying User A’s scenario (403 Forbidden)', async () => {
      const res = await request(app)
        .put(`/api/scenarios/${scenarioA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked Scenario Name' });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/cannot modify another user/i);

      // Verify original scenario was NOT changed
      const original = await dbRepo.findScenarioById(scenarioA.id);
      expect(original.name).toBe('Alpha Warehouse Navigation');
    });

    it('forbids User B from duplicating User A’s scenario (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/scenarios/${scenarioA.id}/duplicate`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Stolen Scenario' });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/cannot duplicate another user/i);
    });

    it('forbids User B from deleting User A’s scenario (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/scenarios/${scenarioA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/cannot delete another user/i);

      // Verify scenario still exists
      const original = await dbRepo.findScenarioById(scenarioA.id);
      expect(original).not.toBeNull();
    });

    it('isolates scenario lists per user: User B does not see User A’s scenarios', async () => {
      // User B creates their own scenario
      await request(app)
        .post('/api/scenarios')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          name: 'Beta Narrow Passage',
          environment: {
            width: 15,
            depth: 15,
            start: { x: 2, z: 2 },
            goal: { x: 12, z: 12 },
          },
        });

      // User A lists scenarios
      const resA = await request(app)
        .get('/api/scenarios')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(resA.status).toBe(200);
      expect(resA.body.scenarios).toHaveLength(1);
      expect(resA.body.scenarios[0].name).toBe('Alpha Warehouse Navigation');

      // User B lists scenarios
      const resB = await request(app)
        .get('/api/scenarios')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(resB.status).toBe(200);
      expect(resB.body.scenarios).toHaveLength(1);
      expect(resB.body.scenarios[0].name).toBe('Beta Narrow Passage');
    });

    it('allows owner to update their own scenario', async () => {
      const res = await request(app)
        .put(`/api/scenarios/${scenarioA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Updated Alpha Navigation',
          description: 'Updated description',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.scenario.name).toBe('Updated Alpha Navigation');
      expect(res.body.scenario.description).toBe('Updated description');
    });

    it('allows owner to duplicate their own scenario', async () => {
      const res = await request(app)
        .post(`/api/scenarios/${scenarioA.id}/duplicate`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Alpha Warehouse Navigation (v2)' });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.scenario.name).toBe('Alpha Warehouse Navigation (v2)');
      expect(res.body.scenario.id).not.toBe(scenarioA.id);
      expect(res.body.scenario.ownerId).toBe(userA.id);
    });

    it('allows owner to delete their own scenario', async () => {
      const res = await request(app)
        .delete(`/api/scenarios/${scenarioA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.deletedId).toBe(scenarioA.id);

      const check = await dbRepo.findScenarioById(scenarioA.id);
      expect(check).toBeNull();
    });
  });

  describe('Scenario Payload Validation & Error Handling', () => {
    it('rejects scenario creation with empty name (400)', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: '   ',
          environment: { start: { x: 0, z: 0 }, goal: { x: 5, z: 5 } },
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Scenario name is required/i);
    });

    it('rejects scenario creation missing environment start or goal (400)', async () => {
      const res = await request(app)
        .post('/api/scenarios')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'No Goal Scenario',
          environment: { start: { x: 0, z: 0 } },
        });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/start and goal coordinates/i);
    });

    it('returns 404 when querying non-existent scenario', async () => {
      const res = await request(app)
        .get('/api/scenarios/non-existent-scenario-999')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Scenario not found/i);
    });

    it('rejects updating scenario with empty name (400)', async () => {
      const createRes = await request(app)
        .post('/api/scenarios')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Valid Initially',
          environment: { start: { x: 0, z: 0 }, goal: { x: 5, z: 5 } },
        });

      const updateRes = await request(app)
        .put(`/api/scenarios/${createRes.body.scenario.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '    ' });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error).toMatch(/Scenario name cannot be empty/i);
    });
  });
});
