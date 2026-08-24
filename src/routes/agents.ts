import { Router, Request, Response } from 'express';
import { activeAgentsGauge } from '../metrics';

const router = Router();

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'stopped';
  type: string;
}

// Datos en memoria (simulación)
const agents: Agent[] = [
  { id: '1', name: 'orchestrator', status: 'active', type: 'coordinator' },
  { id: '2', name: 'worker-alpha', status: 'active', type: 'executor' },
  { id: '3', name: 'worker-beta', status: 'idle', type: 'executor' },
];

/**
 * GET /agents
 * Lista todos los agentes registrados
 */
router.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({ agents, total: agents.length });
});

/**
 * GET /agents/:id
 * Obtiene un agente específico por ID
 */
router.get('/:id', (req: Request, res: Response): void => {
  const agent = agents.find((a) => a.id === req.params['id']);
  if (!agent) {
    res.status(404).json({ error: 'Agente no encontrado' });
    return;
  }
  res.status(200).json(agent);
});

/**
 * POST /agents
 * Registra un nuevo agente
 */
router.post('/', (req: Request, res: Response): void => {
  const { name, type } = req.body as { name?: string; type?: string };
  if (!name || !type) {
    res.status(400).json({ error: 'Se requieren los campos name y type' });
    return;
  }
  const newAgent: Agent = {
    id: String(agents.length + 1),
    name,
    type,
    status: 'active',
  };
  agents.push(newAgent);
  activeAgentsGauge.inc();
  res.status(201).json(newAgent);
});

export default router;
