import express, { Request, Response, NextFunction } from 'express';
import {
  register,
  httpRequestCounter,
  httpRequestDuration,
} from './metrics';
import healthRouter from './routes/health';
import agentsRouter from './routes/agents';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);


// Middleware
app.use(express.json());

// Middleware de métricas — registra duración y contador en cada request
app.use((req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route: string =
      (req as { route?: { path?: string } }).route?.path ?? req.path;
    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: String(res.statusCode),
    });
    httpRequestDuration.observe({ method: req.method, route }, duration);
  });
  next();
});

// Rutas de la aplicación
app.use('/health', healthRouter);
app.use('/agents', agentsRouter);

// Endpoint de métricas Prometheus
app.get('/metrics', (_req: Request, res: Response, next: NextFunction): void => {
  register
    .metrics()
    .then((metrics) => {
      res.set('Content-Type', register.contentType);
      res.end(metrics);
    })
    .catch(next);
});

// Handler de error global
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor solo si no estamos en modo test
if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, () => {
    console.log(`[agents-arq] Servidor corriendo en http://0.0.0.0:${PORT}`);
    console.log(`[agents-arq] Métricas disponibles en http://0.0.0.0:${PORT}/metrics`);
  });
}

export { app };
