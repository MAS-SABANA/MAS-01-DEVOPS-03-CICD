import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Endpoint de liveness para Kubernetes y Prometheus
 */
router.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env['APP_VERSION'] ?? '1.0.0',
  });
});

/**
 * GET /health/ready
 * Readiness probe — verifica que el servicio puede atender tráfico
 */
router.get('/ready', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

export default router;
