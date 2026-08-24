import client from 'prom-client';

// Registro global de métricas
const register = new client.Registry();

// Métricas por defecto (CPU, memoria, event loop, etc.)
client.collectDefaultMetrics({ register });

// Contador de requests HTTP por ruta y método
export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP recibidas',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Histograma de duración de requests
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de peticiones HTTP en segundos',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Gauge de agentes activos (simulado)
export const activeAgentsGauge = new client.Gauge({
  name: 'active_agents_total',
  help: 'Número de agentes activos en el sistema',
  registers: [register],
});

// Inicializar valor del gauge
activeAgentsGauge.set(3);

export { register };
