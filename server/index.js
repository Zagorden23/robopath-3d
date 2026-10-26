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
    });
  } catch (err) {
    console.error('[RoboPath Server] Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();
