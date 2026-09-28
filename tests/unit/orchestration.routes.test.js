const express = require('express');
const request = require('supertest');

function loadRouter() {
  jest.resetModules();
  return require('../../src/routes/orchestration.routes');
}

describe('Orchestration Routes - Unit Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', loadRouter());
  });

  describe('REST Endpoints - Tasks', () => {
    test('GET /api/tasks returns all tasks', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('title');
      expect(res.body[0]).toHaveProperty('status');
    });

    test('GET /api/tasks/:id returns a task when found', async () => {
      const res = await request(app).get('/api/tasks/1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.title).toBe('Implement User Authentication');
    });

    test('GET /api/tasks/:id returns 404 when task is not found', async () => {
      const res = await request(app).get('/api/tasks/9999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    test('POST /api/tasks/:id/move updates task status successfully', async () => {
      const res = await request(app)
        .post('/api/tasks/1/move')
        .send({ status: 'qa' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.taskId).toBe(1);
      expect(res.body.newStatus).toBe('qa');

      // Verify task status was updated in store
      const taskRes = await request(app).get('/api/tasks/1');
      expect(taskRes.body.status).toBe('qa');
    });

    test('POST /api/tasks/:id/move returns 404 for unknown task', async () => {
      const res = await request(app)
        .post('/api/tasks/9999/move')
        .send({ status: 'qa' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    test('POST /api/tasks/:id/intervene handles pause, resume, and retry actions', async () => {
      // Pause action sets status to blocked
      const pauseRes = await request(app)
        .post('/api/tasks/1/intervene')
        .send({ action: 'pause' });
      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.success).toBe(true);
      expect(pauseRes.body.action).toBe('pause');

      let taskRes = await request(app).get('/api/tasks/1');
      expect(taskRes.body.status).toBe('blocked');

      // Resume action sets status to development
      const resumeRes = await request(app)
        .post('/api/tasks/1/intervene')
        .send({ action: 'resume' });
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.action).toBe('resume');

      taskRes = await request(app).get('/api/tasks/1');
      expect(taskRes.body.status).toBe('development');

      // Retry action keeps current status
      const retryRes = await request(app)
        .post('/api/tasks/1/intervene')
        .send({ action: 'retry' });
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.action).toBe('retry');
    });

    test('POST /api/tasks/:id/intervene returns 404 for non-existent task', async () => {
      const res = await request(app)
        .post('/api/tasks/9999/intervene')
        .send({ action: 'pause' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('REST Endpoints - Agents & Health', () => {
    test('GET /api/agents returns all agents', async () => {
      const res = await request(app).get('/api/agents');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(7);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('persona');
    });

    test('GET /api/system/health returns system health metrics', async () => {
      const res = await request(app).get('/api/system/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('apiLatency');
      expect(res.body.dbStatus).toBe('ready');
      expect(res.body).toHaveProperty('agentSummary');
      expect(res.body.agentSummary.total).toBe(7);
    });

    test('POST /api/agents/:agentId/status updates agent status successfully', async () => {
      const res = await request(app)
        .post('/api/agents/agent-pm/status')
        .send({ status: 'working', currentTaskId: 1, lastAction: 'Writing PRD' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.agent.status).toBe('working');
      expect(res.body.agent.currentTaskId).toBe(1);
      expect(res.body.agent.lastAction).toBe('Writing PRD');
    });

    test('POST /api/agents/:agentId/status retains lastAction if omitted', async () => {
      const res = await request(app)
        .post('/api/agents/agent-pm/status')
        .send({ status: 'idle' });

      expect(res.status).toBe(200);
      expect(res.body.agent.status).toBe('idle');
      expect(res.body.agent.lastAction).toBeTruthy();
    });

    test('POST /api/agents/:agentId/status returns 404 for unknown agent', async () => {
      const res = await request(app)
        .post('/api/agents/agent-unknown/status')
        .send({ status: 'idle' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Agent not found' });
    });
  });

  describe('SSE Endpoints', () => {
    let router;

    beforeEach(() => {
      router = loadRouter();
    });

    const getRouteHandler = (path) => {
      const layer = router.stack.find(
        (l) => l.route && l.route.path === path
      );
      return layer.route.stack[0].handle;
    };

    const mockSSERequestResponse = (params = {}) => {
      let closeCallback;
      const req = {
        params,
        on: jest.fn((event, cb) => {
          if (event === 'close') {
            closeCallback = cb;
          }
        }),
      };
      const res = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };
      return { req, res, triggerClose: () => closeCallback && closeCallback() };
    };

    test('GET /agents/status emits SSE connection and agent updates', () => {
      jest.useFakeTimers();
      const handler = getRouteHandler('/agents/status');
      const { req, res, triggerClose } = mockSSERequestResponse();

      handler(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('connected'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('agent_update'));

      // Update an agent to 'working' status to trigger heartbeat interval
      const agentStatusHandler = getRouteHandler('/agents/:agentId/status');
      const mockStatusRes = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      agentStatusHandler(
        { params: { agentId: 'agent-devops' }, body: { status: 'working' } },
        mockStatusRes
      );

      jest.advanceTimersByTime(3000);
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('agent_heartbeat'));

      triggerClose();
      expect(res.end).toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('GET /tasks/:id/cot streams CoT lines and completes', () => {
      jest.useFakeTimers();
      const handler = getRouteHandler('/tasks/:id/cot');
      const { req, res, triggerClose } = mockSSERequestResponse({ id: '1' });

      handler(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('CoT stream connected'));

      jest.advanceTimersByTime(6000);
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('cot_line'));
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('cot_complete'));

      triggerClose();
      expect(res.end).toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('GET /tasks/:id/logs streams execution logs', () => {
      jest.useFakeTimers();
      const handler = getRouteHandler('/tasks/:id/logs');
      const { req, res, triggerClose } = mockSSERequestResponse({ id: '1' });

      handler(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Log stream connected'));

      jest.advanceTimersByTime(5000);
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('execution_log'));

      triggerClose();
      expect(res.end).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
