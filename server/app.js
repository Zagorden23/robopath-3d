import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import scenarioRoutes from './routes/scenarios.js';
import resultsRoutes from './routes/results.js';
import userPreferencesRoutes from './routes/userPreferences.js';
import { getDatabaseStatus } from './db/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  const rawOrigins =
    process.env.CLIENT_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      ok: true,
      service: 'RoboPath 3D API',
      database: getDatabaseStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/scenarios', scenarioRoutes);
  app.use('/api/environments', scenarioRoutes);
  app.use('/api/simulations', resultsRoutes);
  app.use('/api/results', resultsRoutes);
  app.use('/api/user', userPreferencesRoutes);

  // Unknown API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      ok: false,
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Serve built frontend in production when dist exists
  const distPath = path.resolve(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

export const app = createApp();
