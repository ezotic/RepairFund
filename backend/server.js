import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authMiddleware from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import entriesRoutes from './routes/entries.js';
import backupRoutes from './routes/backup.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

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
  // If it's an API route that wasn't caught, it's a 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  // Otherwise, serve the login page
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`RepairFund app listening on port ${PORT}`);
});
