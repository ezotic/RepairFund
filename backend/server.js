import 'dotenv/config';

// Fail fast if required environment variables are missing
const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import authMiddleware from './middleware/auth.js';
import { bootstrapAdmin } from './db/bootstrap.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import entriesRoutes from './routes/entries.js';
import backupRoutes from './routes/backup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(helmet({
  hsts: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: null,
    }
  }
}));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Rate limit login attempts: 20 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' }
});
app.use('/api/auth/login', loginLimiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/entries', authMiddleware, entriesRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/backup', authMiddleware, backupRoutes);

// Catch-all for SPA - redirect to index
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

const PORT = 3000;

const startServer = async () => {
  try {
    await bootstrapAdmin();
    app.listen(PORT, () => {
      console.log(`RepairFund app listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Application startup failed:', err);
    process.exit(1);
  }
};

startServer();
