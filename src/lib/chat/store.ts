/**
 * Chat Store
 * 
 * Postgres-backed store for messages and agent registry.
 * Falls back to in-memory if DATABASE_URL is not set.
 */

import { ChatMessage, Conversation, AgentInfo } from './types';
import { Pool } from 'pg';

// Create pool if DATABASE_URL is available
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

// In-memory fallback
let memMessages: ChatMessage[] = [];
let memAgents: Map<string, AgentInfo> = new Map();
let initialized = false;

// --- Database Setup ---

async function initDb() {
  if (initialized || !pool) return;
  
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        "from" TEXT NOT NULL,
        "to" TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        timestamp BIGINT NOT NULL,
        read BOOLEAN DEFAULT false
      );
      
      CREATE TABLE IF NOT EXISTS chat_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT,
        gateway_url TEXT NOT NULL,
        gateway_token TEXT NOT NULL,
        status TEXT DEFAULT 'unknown',
        last_seen BIGINT
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_from ON chat_messages("from");
      CREATE INDEX IF NOT EXISTS idx_messages_to ON chat_messages("to");
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp);
    `);
    
    console.log('[ChatStore] Database initialized');
    initialized = true;
  } catch (err) {
    console.error('[ChatStore] Failed to initialize database:', err);
  }
}

// --- Message Operations ---

export async function addMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
  const message: ChatMessage = {
    ...msg,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    read: false,
  };
  
  if (pool) {
    await initDb();
    await pool.query(
      `INSERT INTO chat_messages (id, "from", "to", content, type, timestamp, read) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [message.id, message.from, message.to, message.content, message.type || 'text', message.timestamp, message.read]
    );
  } else {
    memMessages.push(message);
    if (memMessages.length > 10000) memMessages = memMessages.slice(-10000);
  }
  
  return message;
}

export async function getMessages(
  participant1: string,
  participant2?: string,
  limit = 100,
): Promise<ChatMessage[]> {
  if (pool) {
    await initDb();
    
    let result;
    if (participant2) {
      result = await pool.query(
        `SELECT * FROM chat_messages 
         WHERE ("from" = $1 AND "to" = $2) OR ("from" = $2 AND "to" = $1)
         ORDER BY timestamp DESC LIMIT $3`,
        [participant1, participant2, limit]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM chat_messages 
         WHERE "from" = $1 OR "to" = $1
         ORDER BY timestamp DESC LIMIT $2`,
        [participant1, limit]
      );
    }
    
    return result.rows.map(row => ({
      id: row.id,
      from: row.from,
      to: row.to,
      content: row.content,
      type: row.type || 'text',
      timestamp: parseInt(row.timestamp),
      read: row.read,
    })).reverse();
  }
  
  // In-memory fallback
  let filtered = memMessages;
  if (participant2) {
    filtered = memMessages.filter(m =>
      (m.from === participant1 && m.to === participant2) ||
      (m.from === participant2 && m.to === participant1)
    );
  } else {
    filtered = memMessages.filter(m =>
      m.from === participant1 || m.to === participant1
    );
  }
  return filtered.slice(-limit);
}

export async function getAllMessages(limit = 500): Promise<ChatMessage[]> {
  if (pool) {
    await initDb();
    const result = await pool.query(
      `SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      from: row.from,
      to: row.to,
      content: row.content,
      type: row.type || 'text',
      timestamp: parseInt(row.timestamp),
      read: row.read,
    })).reverse();
  }
  
  return memMessages.slice(-limit);
}

export async function getBroadcastMessages(limit = 100): Promise<ChatMessage[]> {
  if (pool) {
    await initDb();
    const result = await pool.query(
      `SELECT * FROM chat_messages WHERE "to" = 'broadcast' ORDER BY timestamp DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      from: row.from,
      to: row.to,
      content: row.content,
      type: row.type || 'text',
      timestamp: parseInt(row.timestamp),
      read: row.read,
    })).reverse();
  }
  
  return memMessages.filter(m => m.to === 'broadcast').slice(-limit);
}

export async function getConversations(): Promise<Conversation[]> {
  const messages = await getAllMessages(5000);
  
  const convMap = new Map<string, Conversation>();
  
  for (const msg of messages) {
    const participants = [msg.from, msg.to].sort();
    const convId = participants.join('-');
    
    const existing = convMap.get(convId);
    if (!existing || msg.timestamp > existing.updatedAt) {
      convMap.set(convId, {
        id: convId,
        participants,
        lastMessage: msg,
        unreadCount: existing ? existing.unreadCount + (msg.read ? 0 : 1) : (msg.read ? 0 : 1),
        createdAt: existing?.createdAt || msg.timestamp,
        updatedAt: msg.timestamp,
      });
    }
  }
  
  return [...convMap.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function markRead(participant1: string, participant2: string): Promise<void> {
  if (pool) {
    await initDb();
    await pool.query(
      `UPDATE chat_messages SET read = true 
       WHERE ("from" = $1 AND "to" = $2) OR ("from" = $2 AND "to" = $1)`,
      [participant1, participant2]
    );
  } else {
    for (const msg of memMessages) {
      if (
        (msg.from === participant1 && msg.to === participant2) ||
        (msg.from === participant2 && msg.to === participant1)
      ) {
        msg.read = true;
      }
    }
  }
}

// --- Agent Registry ---

export async function registerAgent(agent: AgentInfo): Promise<void> {
  if (pool) {
    await initDb();
    await pool.query(
      `INSERT INTO chat_agents (id, name, role, gateway_url, gateway_token, status, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         gateway_url = EXCLUDED.gateway_url,
         gateway_token = EXCLUDED.gateway_token,
         status = EXCLUDED.status,
         last_seen = EXCLUDED.last_seen`,
      [agent.id, agent.name, agent.role || null, agent.gatewayUrl, agent.gatewayToken, agent.status || 'online', Date.now()]
    );
  } else {
    memAgents.set(agent.id, agent);
  }
}

// Fetch agent from Railway if not in local store
async function fetchAgentFromRailway(agentId: string): Promise<AgentInfo | undefined> {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || '7ae32d1d-c474-450b-b7f5-6f16e5d875cd';
  
  if (!token || !projectId) return undefined;
  
  try {
    // Find service by name
    const servicesRes = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query($projectId: String!) {
          project(id: $projectId) {
            services {
              edges {
                node {
                  id
                  name
                  deployments(first: 1) {
                    edges { node { staticUrl } }
                  }
                }
              }
            }
          }
        }`,
        variables: { projectId },
      }),
    });
    const servicesData = await servicesRes.json();
    const services = servicesData?.data?.project?.services?.edges || [];
    const service = services.find((s: any) => s.node.name.toLowerCase() === agentId.toLowerCase());
    
    if (!service) return undefined;
    
    // Get gateway token from env vars
    const varsRes = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query($projectId: String!, $serviceId: String!, $environmentId: String!) {
          variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
        }`,
        variables: { projectId, serviceId: service.node.id, environmentId },
      }),
    });
    const varsData = await varsRes.json();
    const vars = varsData?.data?.variables || {};
    
    const gatewayToken = vars.CLAWDBOT_GATEWAY_TOKEN || vars.GATEWAY_TOKEN;
    const domain = service.node.deployments?.edges?.[0]?.node?.staticUrl;
    
    if (!gatewayToken || !domain) return undefined;
    
    return {
      id: agentId,
      name: service.node.name.charAt(0).toUpperCase() + service.node.name.slice(1),
      role: vars.AGENT_ROLE || 'Agent',
      gatewayUrl: `https://${domain}`,
      gatewayToken,
      status: 'online',
    };
  } catch (err) {
    console.error('[ChatStore] Railway fetch error:', err);
    return undefined;
  }
}

export async function getAgent(id: string): Promise<AgentInfo | undefined> {
  // Try local store first
  if (pool) {
    await initDb();
    const result = await pool.query(
      `SELECT * FROM chat_agents WHERE id = $1`,
      [id]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        gatewayUrl: row.gateway_url,
        gatewayToken: row.gateway_token,
        status: row.status,
        lastSeen: row.last_seen ? parseInt(row.last_seen) : undefined,
      };
    }
  } else if (memAgents.has(id)) {
    return memAgents.get(id);
  }
  
  // Fall back to Railway
  const agent = await fetchAgentFromRailway(id);
  if (agent) {
    // Register for future lookups
    await registerAgent(agent);
  }
  return agent;
}

export async function getAllAgents(): Promise<AgentInfo[]> {
  if (pool) {
    await initDb();
    const result = await pool.query(`SELECT * FROM chat_agents`);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      role: row.role,
      gatewayUrl: row.gateway_url,
      gatewayToken: row.gateway_token,
      status: row.status,
      lastSeen: row.last_seen ? parseInt(row.last_seen) : undefined,
    }));
  }
  
  return [...memAgents.values()];
}

export async function updateAgentStatus(id: string, status: AgentInfo['status']): Promise<void> {
  if (pool) {
    await initDb();
    await pool.query(
      `UPDATE chat_agents SET status = $1, last_seen = $2 WHERE id = $3`,
      [status, Date.now(), id]
    );
  } else {
    const agent = memAgents.get(id);
    if (agent) {
      agent.status = status;
    }
  }
}

export async function removeAgent(id: string): Promise<void> {
  if (pool) {
    await initDb();
    await pool.query(`DELETE FROM chat_agents WHERE id = $1`, [id]);
  } else {
    memAgents.delete(id);
  }
}
