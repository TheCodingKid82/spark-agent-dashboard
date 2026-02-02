/**
 * Task Store - STUB (migrated to Convex)
 * 
 * Use Convex mutations directly:
 * - api.tasks.getAll
 * - api.tasks.create
 * - api.tasks.update
 * - api.tasks.remove
 */

import { Task, TaskStatus, TaskPriority, TaskCreateRequest, TaskUpdateRequest, TaskBoard } from './types';

// In-memory fallback only (no pg dependency)
let memTasks: Task[] = [];

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createTask(req: TaskCreateRequest): Promise<Task> {
  const task: Task = {
    id: generateId(),
    agentId: req.agentId,
    title: req.title,
    description: req.description,
    status: req.status || 'backlog',
    priority: req.priority || 'medium',
    createdBy: req.createdBy,
    dueDate: req.dueDate,
    tags: req.tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  memTasks.push(task);
  return task;
}

export async function getTask(id: string): Promise<Task | null> {
  return memTasks.find(t => t.id === id) || null;
}

export async function updateTask(id: string, updates: TaskUpdateRequest): Promise<Task | null> {
  const task = memTasks.find(t => t.id === id);
  if (!task) return null;
  Object.assign(task, updates, { updatedAt: Date.now() });
  if (updates.status === 'done') task.completedAt = Date.now();
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  const idx = memTasks.findIndex(t => t.id === id);
  if (idx >= 0) { memTasks.splice(idx, 1); return true; }
  return false;
}

export async function getTasksForAgent(agentId: string): Promise<Task[]> {
  return memTasks.filter(t => t.agentId === agentId);
}

export async function getTaskBoard(agentId: string, agentName: string): Promise<TaskBoard> {
  const tasks = await getTasksForAgent(agentId);
  
  const columns: TaskBoard['columns'] = {
    backlog: [],
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };
  
  for (const task of tasks) {
    if (columns[task.status]) {
      columns[task.status].push(task);
    }
  }
  
  const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  for (const col of Object.values(columns)) {
    col.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.createdAt - a.createdAt;
    });
  }
  
  return {
    agentId,
    agentName,
    columns,
    totalCount: tasks.length,
  };
}

export async function getAllTasks(limit = 500): Promise<Task[]> {
  return memTasks.slice(0, limit);
}
