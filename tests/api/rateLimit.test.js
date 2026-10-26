import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createRateLimiter } from '../../server/middleware/rateLimit.js';

describe('Rate Limiter Security Middleware', () => {
  it('allows requests within limit and attaches rate limit headers', async () => {
    delete process.env.DISABLE_RATE_LIMIT;

    const testApp = express();
    testApp.use(
      createRateLimiter({
        windowMs: 10000,
        maxRequests: 3,
        message: 'Rate limit exceeded for test.',
      })
    );
    testApp.get('/test', (req, res) => res.json({ ok: true }));

    const res1 = await request(testApp).get('/test');
    expect(res1.status).toBe(200);
    expect(res1.headers['x-ratelimit-limit']).toBe('3');
    expect(res1.headers['x-ratelimit-remaining']).toBe('2');

    const res2 = await request(testApp).get('/test');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('1');

    const res3 = await request(testApp).get('/test');
    expect(res3.status).toBe(200);
    expect(res3.headers['x-ratelimit-remaining']).toBe('0');

    // 4th request exceeds limit
    const res4 = await request(testApp).get('/test');
    expect(res4.status).toBe(429);
    expect(res4.body.ok).toBe(false);
    expect(res4.body.error).toBe('Rate limit exceeded for test.');

    process.env.DISABLE_RATE_LIMIT = 'true';
  });

  it('bypasses rate limiting when DISABLE_RATE_LIMIT is set', async () => {
    process.env.DISABLE_RATE_LIMIT = 'true';

    const testApp = express();
    testApp.use(
      createRateLimiter({
        windowMs: 10000,
        maxRequests: 1,
      })
    );
    testApp.get('/test', (req, res) => res.json({ ok: true }));

    const res1 = await request(testApp).get('/test');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).get('/test');
    expect(res2.status).toBe(200);
  });
});
