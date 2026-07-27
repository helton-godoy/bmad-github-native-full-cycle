'use client';

import { useState } from 'react';
import { ChevronDown, ChevronDownIcon, FileText, Code, TestTube, Shield, Settings, Calendar, User, Tag, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { useTaskStore } from '@/lib/stores/task-store';
import { formatElapsedTime, formatTimestamp } from '@/lib/utils/string-formatters';
import type { Task } from '@/lib/types/schema';
import { TaskStatus, Priority, PersonaType } from '@/lib/types/enums';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { moveTask } = useTaskStore();

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      todo: 'border-gray-300 bg-gray-50',
      planning: 'border-blue-300 bg-blue-50',
      architecture: 'border-indigo-300 bg-indigo-50',
      development: 'border-green-300 bg-green-50',
      qa: 'border-yellow-300 bg-yellow-50',
      done: 'border-purple-300 bg-purple-50'
    };
    return colors[status] || 'border-gray-300 bg-gray-50';
  };

  const getPriorityColor = (priority: Priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
      critical: 'bg-red-600 text-white'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getPersonaIcon = (persona: PersonaType) => {
    const icons: Record<PersonaType, React.ReactNode> = {
      PM: <User className="h-4 w-4" />,
      ARCHITECT: <Settings className="h-4 w-4" />,
      DEVELOPER: <Code className="h-4 w-4" />,
      QA: <TestTube className="h-4 w-4" />,
      SECURITY: <Shield className="h-4 w-4" />,
      DEVOPS: <Settings className="h-4 w-4" />,
      RELEASEMANAGER: <Calendar className="h-4 w-4" />,
      RECOVERY: <Shield className="h-4 w-4" />
    };
    return icons[persona] || <User className="h-4 w-4" />;
  };

  const handleMove = (newStatus: TaskStatus) => {
    moveTask(task.id, newStatus);
  };

  return (
    <Card className={`transition-all hover:shadow-md ${getStatusColor(task.status)}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium">{task.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              {getPersonaIcon(task.persona)}
              {task.persona}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {task.description}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatElapsedTime(task.elapsedTime)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatTimestamp(task.updatedAt)}</span>
          </div>
        </div>

        {task.blockers.length > 0 && (
          <div className="mb-3">
            <Badge variant="outline" className="border-orange-500 text-orange-700 text-xs">
              ⚠️ {task.blockers.length} blocker(s)
            </Badge>
          </div>
        )}

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <ChevronDownIcon className={`h-4 w-4 mr-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              <span>More Details</span>
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="border-t pt-3 mt-3 space-y-3">
              {task.artifacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">Artifacts</h4>
                  <div className="space-y-2">
                    {task.artifacts.map(artifact => (
                      <div key={artifact.id} className="flex items-center gap-2 text-xs">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{artifact.path}</span>
                        <span className="text-muted-foreground">({artifact.linesOfCode || 0} lines)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {task.dependencies.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2">Dependencies</h4>
                  <div className="flex flex-wrap gap-1">
                    {task.dependencies.map(depId => (
                      <Badge key={depId} variant="outline" size="sm">
                        #{depId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold mb-2">Quick Actions</h4>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleMove('development')}
                  >
                    Dev
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleMove('qa')}
                  >
                    QA
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleMove('done')}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}