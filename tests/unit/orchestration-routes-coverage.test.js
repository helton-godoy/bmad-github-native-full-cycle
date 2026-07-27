const express = require('express');
const request = require('supertest');

function loadRouter() {
  jest.resetModules();
  return require('../../src/routes/orchestration.routes');
}

describe('orchestration routes coverage', () => {
  test('covers task, intervention, agent and health REST branches', async () => {
    const app = express();
    app.use(express.json());
    app.use('/orchestration', loadRouter());

    expect((await request(app).get('/orchestration/tasks')).body).toHaveLength(1);
    expect((await request(app).get('/orchestration/tasks/1')).status).toBe(200);
    expect((await request(app).get('/orchestration/tasks/999')).status).toBe(404);
    expect(
      (await request(app).post('/orchestration/tasks/1/move').send({ status: 'qa' })).body
        .newStatus
    ).toBe('qa');
    expect(
      (await request(app).post('/orchestration/tasks/999/move').send({ status: 'qa' })).status
    ).toBe(404);
    for (const action of ['pause', 'resume', 'retry']) {
      expect(
        (await request(app).post('/orchestration/tasks/1/intervene').send({ action })).status
      ).toBe(200);
    }
    expect(
      (await request(app).post('/orchestration/tasks/999/intervene').send({ action: 'pause' }))
        .status
    ).toBe(404);
    expect((await request(app).get('/orchestration/agents')).body).toHaveLength(7);
    expect((await request(app).get('/orchestration/system/health')).body.agentSummary.total).toBe(7);
    expect(
      (
        await request(app)
          .post('/orchestration/agents/agent-pm/status')
          .send({ status: 'working', currentTaskId: 1, lastAction: 'work' })
      ).body.agent.currentTaskId
    ).toBe(1);
    expect(
      (
        await request(app)
          .post('/orchestration/agents/agent-pm/status')
          .send({ status: 'idle', lastAction: '' })
      ).status
    ).toBe(200);
    expect(
      (await request(app).post('/orchestration/agents/missing/status').send({ status: 'idle' }))
        .status
    ).toBe(404);
  });

  test('covers SSE connection, heartbeat, completion and close handlers without sockets', () => {
    jest.useFakeTimers();
    const router = loadRouter();
    const find = (path) =>
      router.stack.find((layer) => layer.route && layer.route.path === path).route.stack[0].handle;
    const makePair = (params = {}) => {
      let close;
      const req = { params, on: jest.fn((_event, callback) => { close = callback; }) };
      const res = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };
      return { req, res, close: () => close() };
    };

    const agents = makePair();
    find('/agents/status')(agents.req, agents.res);
    // Mark an agent working through the REST handler so heartbeat branch executes.
    const statusRes = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    find('/agents/:agentId/status')(
      {
        params: { agentId: 'agent-pm' },
        body: { status: 'working', currentTaskId: 1, lastAction: 'active' },
      },
      statusRes
    );
    jest.advanceTimersByTime(3000);
    expect(agents.res.write).toHaveBeenCalledWith(expect.stringContaining('agent_heartbeat'));
    agents.close();

    const cot = makePair({ id: '1' });
    find('/tasks/:id/cot')(cot.req, cot.res);
    jest.advanceTimersByTime(6000);
    expect(cot.res.write).toHaveBeenCalledWith(expect.stringContaining('cot_complete'));
    cot.close();

    const logs = makePair({ id: '1' });
    find('/tasks/:id/logs')(logs.req, logs.res);
    jest.advanceTimersByTime(5000);
    expect(logs.res.write).toHaveBeenCalledWith(expect.stringContaining('execution_log'));
    logs.close();
    jest.useRealTimers();
  });
});
