import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('TaskFlow API', () => {
  it('GET /api/health returns status 200 and healthy service details', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('Gemini Task Manager API');
  });

  it('GET /api/tasks returns status 200 and an array', async () => {
    const response = await request(app).get('/api/tasks');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
