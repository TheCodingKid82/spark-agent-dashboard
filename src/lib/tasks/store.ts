/**
 * Task Store
 * 
 * Postgres-backed task storage for agent kanban boards
 */

import { Task, TaskStatus, TaskPriority, TaskCreateRequest, TaskUpdateRequest, TaskBoard } from './types';
import { Pool } from 'pg';

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

// In-memory fallback
let memTasks: Task[] = [];
let initialized = false;

async function initDb() {
  if (initialized || !pool) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'backlog',
        priority TEXT DEFAULT 'medium',
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        due_date BIGINT,
        tags TEXT[],
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        completed_at BIGINT
      );
      
      CREATE INDEX IF NOT EXISTS idx_tasks_agent ON agent_tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON agent_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON agent_tasks(created_by);
    `);
    
    console.log('[TaskStore] Database initialized');
    initialized = true;
  } catch (err) {
    console.error('[TaskStore] Failed to initialize:', err);
  }
}

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Task Operations ---

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
  
  if (pool) {
    await initDb();
    await pool.query(
      `INSERT INTO agent_tasks (id, agent_id, title, description, status, priority, created_by, assigned_to, due_date, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [task.id, task.agentId, task.title, task.description, task.status, task.priority, task.createdBy, task.assignedTo, task.dueDate, task.tags, task.createdAt, task.updatedAt]
    );
  } else {
    memTasks.push(task);
  }
  
  return task;
}

export async function getTask(id: string): Promise<Task | null> {
  if (pool) {
    await initDb();
    const result = await pool.query(`SELECT * FROM agent_tasks WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return rowToTask(result.rows[0]);
  }
  return memTasks.find(t => t.id === id) || null;
}

export async function updateTask(id: string, updates: TaskUpdateRequest): Promise<Task | null> {
  const now = Date.now();
  
  if (pool) {
    await initDb();
    const sets: string[] = ['updated_at = $2'];
    const values: unknown[] = [id, now];
    let paramIndex = 3;
    
    if (updates.title !== undefined) { sets.push(`title = $${paramIndex++}`); values.push(updates.title); }
    if (updates.description !== undefined) { sets.push(`description = $${paramIndex++}`); values.push(updates.description); }
    if (updates.status !== undefined) { 
      sets.push(`status = $${paramIndex++}`); 
      values.push(updates.status);
      if (updates.status === 'done') {
        sets.push(`completed_at = $${paramIndex++}`);
        values.push(now);
      }
    }
    if (updates.priority !== undefined) { sets.push(`priority = $${paramIndex++}`); values.push(updates.priority); }
    if (updates.assignedTo !== undefined) { sets.push(`assigned_to = $${paramIndex++}`); values.push(updates.assignedTo); }
    if (updates.dueDate !== undefined) { sets.push(`due_date = $${paramIndex++}`); values.push(updates.dueDate); }
    if (updates.tags !== undefined) { sets.push(`tags = $${paramIndex++}`); values.push(updates.tags); }
    
    await pool.query(
      `UPDATE agent_tasks SET ${sets.join(', ')} WHERE id = $1`,
      values
    );
    
    return getTask(id);
  }
  
  const task = memTasks.find(t => t.id === id);
  if (!task) return null;
  Object.assign(task, updates, { updatedAt: now });
  if (updates.status === 'done') task.completedAt = now;
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  if (pool) {
    await initDb();
    const result = await pool.query(`DELETE FROM agent_tasks WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
  const idx = memTasks.findIndex(t => t.id === id);
  if (idx >= 0) { memTasks.splice(idx, 1); return true; }
  return false;
}

export async function getTasksForAgent(agentId: string): Promise<Task[]> {
  if (pool) {
    await initDb();
    const result = await pool.query(
      `SELECT * FROM agent_tasks WHERE agent_id = $1 ORDER BY created_at DESC`,
      [agentId]
    );
    return result.rows.map(rowToTask);
  }
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
  
  // Sort each column by priority (urgent first) then by created date
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
  if (pool) {
    await initDb();
    const result = await pool.query(
      `SELECT * FROM agent_tasks ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(rowToTask);
  }
  return memTasks.slice(0, limit);
}

// Helper to convert DB row to Task
function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    createdBy: row.created_by as string,
    assignedTo: row.assigned_to as string | undefined,
    dueDate: row.due_date ? Number(row.due_date) : undefined,
    tags: row.tags as string[] | undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    completedAt: row.completed_at ? Number(row.completed_at) : undefined,
  };
}
