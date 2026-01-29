/**
 * Task System Types
 * 
 * Kanban-style tasks for each agent
 */

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  agentId: string;           // Which agent owns this task
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;         // 'andrew', 'henry', or agent id
  assignedTo?: string;       // Can be delegated
  dueDate?: number;          // Unix timestamp
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface TaskCreateRequest {
  agentId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  createdBy: string;
  dueDate?: number;
  tags?: string[];
}

export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  dueDate?: number;
  tags?: string[];
}

export interface TaskBoard {
  agentId: string;
  agentName: string;
  columns: {
    backlog: Task[];
    todo: Task[];
    in_progress: Task[];
    review: Task[];
    done: Task[];
  };
  totalCount: number;
}
