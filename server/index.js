import dotenv from 'dotenv';
import { app } from './app.js';
import { connectDatabase } from './db/database.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

function validateProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwtSecret = process.env.JWT_SECRET || '';
  if (
    jwtSecret.length < 32 ||
    jwtSecret.includes('replace_with_') ||
    jwtSecret.includes('secure_random_')
  ) {
    throw new Error(
      'JWT_SECRET must be a unique production secret of at least 32 characters.'
    );
  }
}

async function bootstrap() {
  try {
    validateProductionConfig();
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`[RoboPath Server] Listening on http://localhost:${PORT}`);

      // Keep-warm heartbeat in production so Render container avoids cold-start spin-down
      const externalUrl =
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.CLIENT_ORIGIN?.startsWith('https://') ? process.env.CLIENT_ORIGIN : null);
      if (process.env.NODE_ENV === 'production' && externalUrl) {
        const healthUrl = `${externalUrl.replace(/\/+$/, '')}/api/health`;
        const interval = setInterval(() => {
          fetch(healthUrl).catch(() => {});
        }, 13 * 60 * 1000);
        if (typeof interval.unref === 'function') {
          interval.unref();
        }
      }
    });
  } catch (err) {
    console.error('[RoboPath Server] Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();
