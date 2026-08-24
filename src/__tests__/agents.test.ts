import request from 'supertest';
import { app } from '../index';

describe('GET /agents', () => {
  it('debería retornar la lista de agentes', async () => {
    const res = await request(app).get('/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('agents');
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('debería retornar un agente específico por ID', async () => {
    const res = await request(app).get('/agents/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', '1');
    expect(res.body).toHaveProperty('name', 'orchestrator');
  });

  it('debería retornar 404 para un agente inexistente', async () => {
    const res = await request(app).get('/agents/999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /agents', () => {
  it('debería crear un nuevo agente', async () => {
    const res = await request(app)
      .post('/agents')
      .send({ name: 'worker-gamma', type: 'executor' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'worker-gamma');
    expect(res.body).toHaveProperty('status', 'active');
  });

  it('debería retornar 400 si faltan campos requeridos', async () => {
    const res = await request(app).post('/agents').send({ name: 'solo-name' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
