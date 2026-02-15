/* global setInterval, clearInterval */
const express = require('express');
const router = express.Router();

// SSE helper function
function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * SSE Endpoint - Agent Status Stream
 * Emits agent status changes in real-time
 */
router.get('/agents/status', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  sendSSE(res, { type: 'connected', message: 'Agent status stream connected' });

  // Mock: Send agent status updates every 5 seconds
  const interval = setInterval(() => {
    const mockUpdate = {
      type: 'agent_status_update',
      timestamp: new Date().toISOString(),
      agent: {
        id: 'agent-developer',
        persona: 'DEVELOPER',
        status: Math.random() > 0.5 ? 'working' : 'idle',
        currentTaskId: 42,
        lastAction: 'Implementing JWT validation',
      },
    };
    sendSSE(res, mockUpdate);
  }, 5000);

  // Cleanup on connection close
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * SSE Endpoint - Chain of Thought Stream for a task
 * Streams CoT lines as the agent processes the task
 */
router.get('/tasks/:id/cot', (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sendSSE(res, {
    type: 'connected',
    taskId: id,
    message: 'CoT stream connected',
  });

  // Mock: Stream CoT lines
  const cotLines = [
    'Analyzing requirements from PRD...',
    'Identified need for JWT-based auth',
    'Creating auth.service.ts file',
    'Implementing token generation logic',
    'Adding token validation middleware',
    'Running unit tests... 8/10 passed ✅',
    'Fixing failing test cases...',
    'All tests passing ✅',
    'Code ready for review',
  ];

  let lineIndex = 0;
  const interval = setInterval(() => {
    if (lineIndex < cotLines.length) {
      sendSSE(res, {
        type: 'cot_line',
        taskId: parseInt(id),
        timestamp: new Date().toISOString(),
        content: cotLines[lineIndex],
      });
      lineIndex++;
    } else {
      clearInterval(interval);
      sendSSE(res, { type: 'cot_complete', taskId: parseInt(id) });
    }
  }, 2000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * SSE Endpoint - Execution Logs Stream for a task
 * Streams technical execution logs
 */
router.get('/tasks/:id/logs', (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  sendSSE(res, {
    type: 'connected',
    taskId: id,
    message: 'Log stream connected',
  });

  // Mock: Stream logs
  const mockLogs = [
    {
      level: 'info',
      message: 'Started implementation of auth service',
      source: 'developer-agent',
    },
    {
      level: 'info',
      message: 'Created file: src/services/auth.service.ts',
      source: 'developer-agent',
    },
    {
      level: 'warn',
      message: 'Deprecation warning: jwt.verify() options parameter',
      source: 'eslint',
    },
    {
      level: 'info',
      message: 'Running test suite: auth.test.ts',
      source: 'jest',
    },
    {
      level: 'error',
      message: 'Test failed: should handle expired tokens',
      source: 'jest',
    },
    { level: 'info', message: 'All tests passed (10/10) ✅', source: 'jest' },
  ];

  let logIndex = 0;
  const interval = setInterval(() => {
    if (logIndex < mockLogs.length) {
      sendSSE(res, {
        type: 'execution_log',
        taskId: parseInt(id),
        timestamp: new Date().toISOString(),
        ...mockLogs[logIndex],
      });
      logIndex++;
    } else {
      clearInterval(interval);
    }
  }, 3000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * REST Endpoints
 */

// Get all tasks
router.get('/tasks', (req, res) => {
  // Mock tasks data
  const tasks = [
    {
      id: 42,
      title: 'Implement Authentication Service',
      description: 'Create JWT-based authentication service',
      status: 'development',
      persona: 'DEVELOPER',
      priority: 'high',
      assignedAgent: 'DEVELOPER',
      createdAt: new Date(Date.now() - 9000000).toISOString(),
      updatedAt: new Date().toISOString(),
      elapsedTime: 9000000,
      dependencies: [38, 39],
      artifacts: [],
      blockers: [],
      workflowId: 'wf-2026-001',
      issueNumber: 42,
    },
  ];

  res.json(tasks);
});

// Get task by ID
router.get('/tasks/:id', (req, res) => {
  const { id } = req.params;
  // Mock task detail
  const task = {
    id: parseInt(id),
    title: 'Implement Authentication Service',
    status: 'development',
    persona: 'DEVELOPER',
  };
  res.json(task);
});

// Move task to new column
router.post('/tasks/:id/move', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Mock response
  res.json({
    success: true,
    taskId: parseInt(id),
    newStatus: status,
    message: `Task #${id} moved to ${status}`,
  });
});

// Intervene in workflow
router.post('/tasks/:id/intervene', (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'pause' | 'resume' | 'retry'

  res.json({
    success: true,
    taskId: parseInt(id),
    action,
    message: `Workflow ${action} action executed for task #${id}`,
  });
});

// Get all agents
router.get('/agents', (req, res) => {
  const agents = [
    {
      id: 'agent-pm',
      persona: 'PM',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Created PRD',
      lastActionTime: new Date().toISOString(),
    },
    {
      id: 'agent-developer',
      persona: 'DEVELOPER',
      status: 'working',
      currentTaskId: 42,
      activeTime: 9000000,
      lastAction: 'Implementing JWT',
      lastActionTime: new Date().toISOString(),
    },
  ];

  res.json(agents);
});

// Get system health
router.get('/system/health', (req, res) => {
  res.json({
    apiLatency: Math.floor(Math.random() * 20) + 5,
    dbStatus: 'ready',
    queueUsage: Math.floor(Math.random() * 30) + 60,
    activeWorkflows: 2,
    completedToday: 8,
  });
});

module.exports = router;
