import express, { Application } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import materialsRoutes from './modules/materials/materials.routes';
import recipesRoutes from './modules/recipes/recipes.routes';
import batchesRoutes from './modules/batches/batches.routes';
import reportsRoutes from './modules/reports/reports.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();

// Middleware
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/batches', batchesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
