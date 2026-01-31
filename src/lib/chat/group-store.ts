/**
 * Group Store
 * 
 * Postgres-backed store for group chats.
 * Enables persistent group conversations where agents can:
 * - See messages from other agents
 * - Post messages proactively
 * - Poll for new messages
 */

import { Pool } from 'pg';

export interface Group {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  from: string;
  content: string;
  timestamp: number;
}

// Create pool if DATABASE_URL is available
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

// In-memory fallback
let memGroups: Group[] = [];
let memGroupMessages: GroupMessage[] = [];
let initialized = false;

// --- Database Setup ---

async function initDb() {
  if (initialized || !pool) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        members TEXT[] NOT NULL,
        created_by TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS chat_group_messages (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
        "from" TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_group_messages_group ON chat_group_messages(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_messages_timestamp ON chat_group_messages(timestamp);
    `);
    
    console.log('[GroupStore] Database initialized');
    initialized = true;
  } catch (err) {
    console.error('[GroupStore] Failed to initialize database:', err);
  }
}

// --- Group Operations ---

export async function createGroup(input: {
  name: string;
  members: string[];
  createdBy: string;
}): Promise<Group> {
  const group: Group = {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    members: input.members,
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };
  
  if (pool) {
    await initDb();
    await pool.query(
      `INSERT INTO chat_groups (id, name, members, created_by, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [group.id, group.name, group.members, group.createdBy, group.createdAt]
    );
  } else {
    memGroups.push(group);
  }
  
  return group;
}

export async function getGroup(id: string): Promise<Group | undefined> {
  if (pool) {
    await initDb();
    const result = await pool.query(`SELECT * FROM chat_groups WHERE id = $1`, [id]);
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      members: row.members,
      createdBy: row.created_by,
      createdAt: parseInt(row.created_at),
    };
  }
  
  return memGroups.find(g => g.id === id);
}

export async function getGroups(member?: string): Promise<Group[]> {
  if (pool) {
    await initDb();
    let result;
    if (member) {
      result = await pool.query(
        `SELECT * FROM chat_groups WHERE $1 = ANY(members) ORDER BY created_at DESC`,
        [member]
      );
    } else {
      result = await pool.query(`SELECT * FROM chat_groups ORDER BY created_at DESC`);
    }
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      members: row.members,
      createdBy: row.created_by,
      createdAt: parseInt(row.created_at),
    }));
  }
  
  if (member) {
    return memGroups.filter(g => g.members.includes(member));
  }
  return memGroups;
}

export async function deleteGroup(id: string): Promise<void> {
  if (pool) {
    await initDb();
    await pool.query(`DELETE FROM chat_groups WHERE id = $1`, [id]);
  } else {
    memGroups = memGroups.filter(g => g.id !== id);
    memGroupMessages = memGroupMessages.filter(m => m.groupId !== id);
  }
}

export async function addMember(groupId: string, memberId: string): Promise<void> {
  if (pool) {
    await initDb();
    await pool.query(
      `UPDATE chat_groups SET members = array_append(members, $1) WHERE id = $2 AND NOT ($1 = ANY(members))`,
      [memberId, groupId]
    );
  } else {
    const group = memGroups.find(g => g.id === groupId);
    if (group && !group.members.includes(memberId)) {
      group.members.push(memberId);
    }
  }
}

export async function removeMember(groupId: string, memberId: string): Promise<void> {
  if (pool) {
    await initDb();
    await pool.query(
      `UPDATE chat_groups SET members = array_remove(members, $1) WHERE id = $2`,
      [memberId, groupId]
    );
  } else {
    const group = memGroups.find(g => g.id === groupId);
    if (group) {
      group.members = group.members.filter(m => m !== memberId);
    }
  }
}

// --- Message Operations ---

export async function addGroupMessage(input: {
  groupId: string;
  from: string;
  content: string;
}): Promise<GroupMessage> {
  const message: GroupMessage = {
    id: `gmsg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    groupId: input.groupId,
    from: input.from,
    content: input.content,
    timestamp: Date.now(),
  };
  
  if (pool) {
    await initDb();
    await pool.query(
      `INSERT INTO chat_group_messages (id, group_id, "from", content, timestamp) VALUES ($1, $2, $3, $4, $5)`,
      [message.id, message.groupId, message.from, message.content, message.timestamp]
    );
  } else {
    memGroupMessages.push(message);
    if (memGroupMessages.length > 10000) {
      memGroupMessages = memGroupMessages.slice(-10000);
    }
  }
  
  return message;
}

export async function getGroupMessages(
  groupId: string,
  since?: number,
  limit = 50
): Promise<GroupMessage[]> {
  if (pool) {
    await initDb();
    let result;
    if (since) {
      result = await pool.query(
        `SELECT * FROM chat_group_messages 
         WHERE group_id = $1 AND timestamp > $2 
         ORDER BY timestamp ASC LIMIT $3`,
        [groupId, since, limit]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM chat_group_messages 
         WHERE group_id = $1 
         ORDER BY timestamp DESC LIMIT $2`,
        [groupId, limit]
      );
      result.rows.reverse();
    }
    return result.rows.map(row => ({
      id: row.id,
      groupId: row.group_id,
      from: row.from,
      content: row.content,
      timestamp: parseInt(row.timestamp),
    }));
  }
  
  let messages = memGroupMessages.filter(m => m.groupId === groupId);
  if (since) {
    messages = messages.filter(m => m.timestamp > since);
  }
  return messages.slice(-limit);
}
