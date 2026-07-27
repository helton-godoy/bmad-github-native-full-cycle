/* global setInterval, clearInterval */
const express = require('express');
const router = express.Router();

// In-memory stores for real-time data
const agentStore = new Map();
const taskStore = new Map();

// Initialize with default data
const initializeStores = () => {
  // Initialize agents
  const agents = [
    {
      id: 'agent-pm',
      persona: 'PM',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Ready for new tasks',
      lastActionTime: new Date().toISOString()
    },
    {
      id: 'agent-architect',
      persona: 'ARCHITECT',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Ready for architecture tasks',
      lastActionTime: new Date().toISOString()
    },
    {
      id: 'agent-developer',
      persona: 'DEVELOPER',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Ready for implementation',
      lastActionTime: new Date().toISOString()
    },
    {
      id: 'agent-qa',
      persona: 'QA',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Ready for testing',
      lastActionTime: new Date().toISOString()
    },
    {
      id: 'agent-security',
      persona: 'SECURITY',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Ready for security review',
      lastActionTime: new Date().toISOString()
    },
    {
      id: 'agent-devops',
      persona: 'DEVOPS',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Ready for deployment',
      lastActionTime: new Date().toISOString()
    },
    {
      id: 'agent-release',
      persona: 'RELEASEMANAGER',
      status: 'idle',
      currentTaskId: null,
      activeTime: 0,
      lastAction: 'Ready for releases',
      lastActionTime: new Date().toISOString()
    }
  ];

  agents.forEach(agent => agentStore.set(agent.id, agent));

  // Initialize tasks
  const tasks = [
    {
      id: 1,
      title: 'Implement User Authentication',
      description: 'Create JWT-based authentication system',
      status: 'development',
      persona: 'DEVELOPER',
      priority: 'high',
      assignedAgent: 'agent-developer',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      elapsedTime: 7200000,
      dependencies: [],
      artifacts: [],
      blockers: [],
      workflowId: 'wf-2026-001',
      issueNumber: 1
    }
  ];

  tasks.forEach(task => taskStore.set(task.id, task));
};

// Initialize stores on load
initializeStores();

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

  // Send current agent states
  agentStore.forEach(agent => {
    sendSSE(res, {
      type: 'agent_update',
      agent
    });
  });

  // Send real-time updates every 3 seconds
  const interval = setInterval(() => {
    agentStore.forEach(agent => {
      // Send periodic heartbeat for active agents
      if (agent.status === 'working') {
        sendSSE(res, {
          type: 'agent_heartbeat',
          agentId: agent.id,
          timestamp: new Date().toISOString()
        });
      }
    });
  }, 3000);

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
    taskId: parseInt(id),
    message: 'CoT stream connected'
  });

  // Simulate CoT stream based on task progress
  const cotLines = [
    { content: 'Analyzing requirements from PRD...', delay: 500 },
    { content: 'Identified need for JWT-based authentication', delay: 1000 },
    { content: 'Creating auth.service.js file', delay: 1500 },
    { content: 'Implementing token generation logic', delay: 2000 },
    { content: 'Adding token validation middleware', delay: 2500 },
    { content: 'Implementing password hashing with bcrypt', delay: 3000 },
    { content: 'Running unit tests... 8/10 passed ✅', delay: 1000 },
    { content: 'Fixing failing test cases...', delay: 1500 },
    { content: 'All tests passing (10/10) ✅', delay: 1000 },
    { content: 'Code ready for review', delay: 500 }
  ];

  let lineIndex = 0;
  const interval = setInterval(() => {
    if (lineIndex < cotLines.length) {
      const line = cotLines[lineIndex];
      sendSSE(res, {
        type: 'cot_line',
        taskId: parseInt(id),
        timestamp: new Date().toISOString(),
        content: line.content
      });
      lineIndex++;
    } else {
      clearInterval(interval);
      sendSSE(res, { type: 'cot_complete', taskId: parseInt(id) });
    }
  }, 500);

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
    taskId: parseInt(id),
    message: 'Log stream connected'
  });

  // Simulate log stream
  const mockLogs = [
    { level: 'info', message: 'Started implementation of auth service', source: 'developer-agent', delay: 500 },
    { level: 'info', message: 'Created file: src/services/auth.service.js', source: 'developer-agent', delay: 1000 },
    { level: 'info', message: 'Created file: src/utils/jwt.util.js', source: 'developer-agent', delay: 800 },
    { level: 'warn', message: 'Deprecation warning: jwt.verify() options parameter', source: 'eslint', delay: 500 },
    { level: 'info', message: 'Running test suite: auth.test.js', source: 'jest', delay: 1000 },
    { level: 'error', message: 'Test failed: should handle expired tokens', source: 'jest', delay: 300 },
    { level: 'info', message: 'Fixed test case for expired tokens', source: 'developer-agent', delay: 2000 },
    { level: 'info', message: 'All tests passed (10/10) ✅', source: 'jest', delay: 500 }
  ];

  let logIndex = 0;
  const interval = setInterval(() => {
    if (logIndex < mockLogs.length) {
      const log = mockLogs[logIndex];
      sendSSE(res, {
        type: 'execution_log',
        taskId: parseInt(id),
        timestamp: new Date().toISOString(),
        level: log.level,
        message: log.message,
        source: log.source
      });
      logIndex++;
    } else {
      clearInterval(interval);
    }
  }, 500);

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
  const tasks = Array.from(taskStore.values()).map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    persona: task.persona,
    priority: task.priority,
    assignedAgent: task.assignedAgent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    elapsedTime: task.elapsedTime,
    dependencies: task.dependencies,
    artifacts: task.artifacts,
    blockers: task.blockers,
    workflowId: task.workflowId,
    issueNumber: task.issueNumber
  }));

  res.json(tasks);
});

// Get task by ID
router.get('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const task = taskStore.get(parseInt(id));

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    persona: task.persona,
    priority: task.priority,
    assignedAgent: task.assignedAgent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    elapsedTime: task.elapsedTime,
    dependencies: task.dependencies,
    artifacts: task.artifacts,
    blockers: task.blockers,
    workflowId: task.workflowId,
    issueNumber: task.issueNumber
  });
});

// Move task to new column
router.post('/tasks/:id/move', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const task = taskStore.get(parseInt(id));
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  task.status = status;
  task.updatedAt = new Date().toISOString();
  taskStore.set(parseInt(id), task);

  res.json({
    success: true,
    taskId: parseInt(id),
    newStatus: status,
    message: `Task #${id} moved to ${status}`
  });
});

// Intervene in workflow
router.post('/tasks/:id/intervene', (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'pause' | 'resume' | 'retry'

  const task = taskStore.get(parseInt(id));
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Apply intervention
  if (action === 'pause') {
    task.status = 'blocked';
  } else if (action === 'resume') {
    task.status = 'development';
  }

  taskStore.set(parseInt(id), task);

  res.json({
    success: true,
    taskId: parseInt(id),
    action,
    message: `Workflow ${action} action executed for task #${id}`
  });
});

// Get all agents
router.get('/agents', (req, res) => {
  const agents = Array.from(agentStore.values()).map(agent => ({
    id: agent.id,
    persona: agent.persona,
    status: agent.status,
    currentTaskId: agent.currentTaskId,
    activeTime: agent.activeTime,
    lastAction: agent.lastAction,
    lastActionTime: agent.lastActionTime
  }));

  res.json(agents);
});

// Get system health
router.get('/system/health', (req, res) => {
  const agentStatuses = Array.from(agentStore.values()).map(a => a.status);
  const activeCount = agentStatuses.filter(s => s === 'working').length;
  const totalCount = agentStatuses.length;

  res.json({
    apiLatency: Math.floor(Math.random() * 20) + 5,
    dbStatus: 'ready',
    queueUsage: Math.floor(Math.random() * 30) + 60,
    activeWorkflows: activeCount,
    completedToday: 8,
    agentSummary: {
      total: totalCount,
      active: activeCount,
      idle: totalCount - activeCount
    }
  });
});

// Update agent status (for BMAD personas to call)
router.post('/agents/:agentId/status', (req, res) => {
  const { agentId } = req.params;
  const { status, currentTaskId, lastAction } = req.body;

  const agent = agentStore.get(agentId);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  agent.status = status;
  if (currentTaskId !== undefined) {
    agent.currentTaskId = currentTaskId;
  }
  agent.lastAction = lastAction || agent.lastAction;
  agent.lastActionTime = new Date().toISOString();
  agent.activeTime += 1000; // Increment active time

  agentStore.set(agentId, agent);

  res.json({ success: true, agent });
});

module.exports = router;