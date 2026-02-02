/**
 * Mission Control Database Schema
 * 
 * PostgreSQL database for the Mission Control system
 * - Agents (from roster)
 * - Tasks (Kanban: inbox, assigned, in_progress, review, done)
 * - Messages/Comments (linked to tasks)
 * - Activities (real-time stream)
 * - Documents (deliverables with Markdown)
 * - Notifications (@mentions)
 * - Subscriptions (thread subscriptions)
 */

import { Pool, QueryResultRow } from 'pg';

// Create pool if DATABASE_URL is available
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

/**
 * Tagged template SQL function
 * Usage: sql`SELECT * FROM table WHERE id = ${id}`
 */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  if (!pool) {
    console.warn('DATABASE_URL not set, returning empty array');
    return [];
  }

  // Build parameterized query
  let query = '';
  const params: unknown[] = [];
  
  strings.forEach((str, i) => {
    query += str;
    if (i < values.length) {
      params.push(values[i]);
      query += `$${params.length}`;
    }
  });

  try {
    const result = await pool.query<T>(query, params);
    return result.rows;
  } catch (error) {
    console.error('SQL error:', error);
    throw error;
  }
}

/**
 * Raw query function for complex queries
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  if (!pool) {
    console.warn('DATABASE_URL not set, returning empty array');
    return [];
  }

  try {
    const result = await pool.query<T>(text, params);
    return result.rows;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

/**
 * Initialize the Mission Control database schema
 */
export async function initMissionControlDb(): Promise<void> {
  if (!pool) {
    console.warn('[MissionControl] DATABASE_URL not set, skipping DB init');
    return;
  }

  try {
    // Agents table - source of truth from agent-roster.json
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mc_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        emoji TEXT,
        status TEXT DEFAULT 'offline',
        purpose TEXT,
        specialties TEXT[],
        parent_id TEXT,
        reports_to TEXT,
        level TEXT,
        workspace TEXT,
        session_key TEXT,
        heartbeat_cron TEXT,
        tools TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tasks table - Kanban style
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mc_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'inbox' CHECK (status IN ('inbox', 'assigned', 'in_progress', 'review', 'done')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        due_date TIMESTAMP,
        tags TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);

    // Messages/Comments table - linked to tasks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mc_messages (
        id TEXT PRIMARY KEY,
        task_id TEXT REFERENCES mc_tasks(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL,
        author_type TEXT DEFAULT 'agent' CHECK (author_type IN ('agent', 'human')),
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'comment' CHECK (message_type IN ('comment', 'system', 'activity')),
        parent_id TEXT REFERENCES mc_messages(id) ON DELETE CASCADE,
        mentions TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Activities table - real-time stream of everything
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mc_activities (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_type TEXT DEFAULT 'agent' CHECK (actor_type IN ('agent', 'human', 'system')),
        action TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK (target_type IN ('task', 'message', 'document', 'agent')),
        target_id TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Documents table - deliverables with Markdown support
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mc_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'markdown' CHECK (content_type IN ('markdown', 'text', 'json')),
        author_id TEXT NOT NULL,
        task_id TEXT REFERENCES mc_tasks(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
        version INTEGER DEFAULT 1,
        tags TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Notifications table - @mentions and alerts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mc_notifications (
        id TEXT PRIMARY KEY,
        recipient_id TEXT NOT NULL,
        sender_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('mention', 'assignment', 'comment', 'status_change', 'system')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Subscriptions table - thread subscriptions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mc_subscriptions (
        id TEXT PRIMARY KEY,
        subscriber_id TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK (target_type IN ('task', 'document')),
        target_id TEXT NOT NULL,
        auto_subscribed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(subscriber_id, target_type, target_id)
      );
    `);

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON mc_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON mc_tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON mc_tasks(created_by);
      CREATE INDEX IF NOT EXISTS idx_messages_task ON mc_messages(task_id);
      CREATE INDEX IF NOT EXISTS idx_messages_author ON mc_messages(author_id);
      CREATE INDEX IF NOT EXISTS idx_activities_actor ON mc_activities(actor_id);
      CREATE INDEX IF NOT EXISTS idx_activities_target ON mc_activities(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_activities_created ON mc_activities(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_task ON mc_documents(task_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON mc_notifications(recipient_id, read);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_target ON mc_subscriptions(target_type, target_id);
    `);

    console.log('[MissionControl] Database initialized successfully');
  } catch (error) {
    console.error('[MissionControl] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Sync agents from roster to database
 */
export async function syncAgentsFromRoster(agents: Array<{
  id: string;
  name: string;
  role: string;
  reportsTo?: string;
  sessionKey?: string;
  soulFile?: string;
  workspace?: string;
  heartbeatCron?: string;
  level?: string;
  tools?: string[];
}>): Promise<void> {
  if (!pool) return;

  try {
    for (const agent of agents) {
      await pool.query(`
        INSERT INTO mc_agents (id, name, role, reports_to, session_key, workspace, heartbeat_cron, level, tools)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          reports_to = EXCLUDED.reports_to,
          session_key = EXCLUDED.session_key,
          workspace = EXCLUDED.workspace,
          heartbeat_cron = EXCLUDED.heartbeat_cron,
          level = EXCLUDED.level,
          tools = EXCLUDED.tools,
          updated_at = CURRENT_TIMESTAMP
      `, [
        agent.id,
        agent.name,
        agent.role,
        agent.reportsTo || null,
        agent.sessionKey || null,
        agent.workspace || null,
        agent.heartbeatCron || null,
        agent.level || 'specialist',
        agent.tools || []
      ]);
    }
    console.log(`[MissionControl] Synced ${agents.length} agents from roster`);
  } catch (error) {
    console.error('[MissionControl] Failed to sync agents:', error);
    throw error;
  }
}

export { pool };

// Export types
export type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageType = 'comment' | 'system' | 'activity';
export type ActivityTargetType = 'task' | 'message' | 'document' | 'agent';
export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'archived';
export type NotificationType = 'mention' | 'assignment' | 'comment' | 'status_change' | 'system';
export type SubscriptionTargetType = 'task' | 'document';

export interface Agent {
  id: string;
  name: string;
  role: string;
  emoji?: string;
  status: string;
  purpose?: string;
  specialties?: string[];
  parent_id?: string;
  reports_to?: string;
  level?: string;
  workspace?: string;
  session_key?: string;
  heartbeat_cron?: string;
  tools?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  assigned_to?: string;
  due_date?: Date;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

export interface Message {
  id: string;
  task_id?: string;
  author_id: string;
  author_type: 'agent' | 'human';
  content: string;
  message_type: MessageType;
  parent_id?: string;
  mentions?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Activity {
  id: string;
  actor_id: string;
  actor_type: 'agent' | 'human' | 'system';
  action: string;
  target_type: ActivityTargetType;
  target_id: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  content_type: 'markdown' | 'text' | 'json';
  author_id: string;
  task_id?: string;
  status: DocumentStatus;
  version: number;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Notification {
  id: string;
  recipient_id: string;
  sender_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  target_type: string;
  target_id: string;
  read: boolean;
  created_at: Date;
}

export interface Subscription {
  id: string;
  subscriber_id: string;
  target_type: SubscriptionTargetType;
  target_id: string;
  auto_subscribed: boolean;
  created_at: Date;
}
