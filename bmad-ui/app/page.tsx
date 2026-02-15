'use client';

import { mockTasks, mockAgents, mockSystemHealth } from '@/lib/data/mock-data';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-(--color-page-bg)">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">
            🎯 BMAD Orchestration Hub
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Sprint 1</span>
          <div className="w-8 h-8 rounded-full bg-gray-200" />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-72 bg-(--color-sidebar-bg) border-r border-gray-200 p-4 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Agents</h2>
            <div className="space-y-2">
              {mockAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      agent.status === 'working' ? 'bg-blue-500 status-dot-pulse' :
                      agent.status === 'blocked' ? 'bg-orange-500' :
                      'bg-gray-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{agent.persona}</div>
                    <div className="text-xs text-gray-500 truncate">{agent.lastAction}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">System Health</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">API</span>
                <span className="text-green-600 font-medium">{mockSystemHealth.apiLatency}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Database</span>
                <span className="text-green-600 font-medium">Ready</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Queue</span>
                <span className="text-orange-600 font-medium">{mockSystemHealth.queueUsage}%</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Kanban Board */}
        <main className="flex-1 p-6 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {['todo', 'planning', 'architecture', 'development', 'qa', 'done'].map((status) => (
              <div key={status} className="w-80 flex-shrink-0">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase">
                      {status}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {mockTasks.filter(t => t.status === status).length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {mockTasks
                      .filter((task) => task.status === status)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                          style={{ borderLeftWidth: '4px', borderLeftColor: '#3b82f6' }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500">#{task.id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              task.priority === 'high' ? 'bg-red-100 text-red-700' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{task.persona}</span>
                            <span>•</span>
                            <span>2h 30m</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
