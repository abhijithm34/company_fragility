const request = require('supertest');
const { app } = require('../src/server');

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'fragility-dashboard-backend');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });
});

describe('Unknown routes', () => {
  it('returns 404 for GET /api/unknown', async () => {
    const res = await request(app).get('/api/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'Route not found');
  });

  it('returns 404 for POST /api/nonexistent', async () => {
    const res = await request(app).post('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'Route not found');
  });
});
