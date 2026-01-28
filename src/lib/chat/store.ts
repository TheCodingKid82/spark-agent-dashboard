/**
 * Chat Store
 * 
 * In-memory store with file persistence for messages between agents.
 * In production, this would be a proper database.
 */

import { ChatMessage, Conversation, AgentInfo } from './types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = process.env.CHAT_DATA_DIR || '/tmp/agent-chat';
const MESSAGES_FILE = join(DATA_DIR, 'messages.json');
const AGENTS_FILE = join(DATA_DIR, 'agents.json');

// In-memory cache
let messages: ChatMessage[] = [];
let agents: Map<string, AgentInfo> = new Map();
let initialized = false;

// --- Initialization ---

async function ensureDataDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // Ignore if exists
  }
}

async function loadData() {
  if (initialized) return;
  
  await ensureDataDir();
  
  try {
    const msgData = await readFile(MESSAGES_FILE, 'utf-8');
    messages = JSON.parse(msgData);
  } catch {
    messages = [];
  }
  
  try {
    const agentData = await readFile(AGENTS_FILE, 'utf-8');
    const agentList: AgentInfo[] = JSON.parse(agentData);
    agents = new Map(agentList.map(a => [a.id, a]));
  } catch {
    agents = new Map();
  }
  
  initialized = true;
}

async function saveMessages() {
  await ensureDataDir();
  await writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

async function saveAgents() {
  await ensureDataDir();
  await writeFile(AGENTS_FILE, JSON.stringify([...agents.values()], null, 2));
}

// --- Message Operations ---

export async function addMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
  await loadData();
  
  const message: ChatMessage = {
    ...msg,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    read: false,
  };
  
  messages.push(message);
  
  // Keep last 10000 messages
  if (messages.length > 10000) {
    messages = messages.slice(-10000);
  }
  
  await saveMessages();
  return message;
}

export async function getMessages(
  participant1: string,
  participant2?: string,
  limit = 100,
): Promise<ChatMessage[]> {
  await loadData();
  
  let filtered = messages;
  
  if (participant2) {
    // Get conversation between two participants
    filtered = messages.filter(m =>
      (m.from === participant1 && m.to === participant2) ||
      (m.from === participant2 && m.to === participant1)
    );
  } else {
    // Get all messages involving one participant
    filtered = messages.filter(m =>
      m.from === participant1 || m.to === participant1
    );
  }
  
  return filtered.slice(-limit);
}

export async function getAllMessages(limit = 500): Promise<ChatMessage[]> {
  await loadData();
  return messages.slice(-limit);
}

export async function getConversations(): Promise<Conversation[]> {
  await loadData();
  
  const convMap = new Map<string, Conversation>();
  
  for (const msg of messages) {
    const participants = [msg.from, msg.to].sort();
    const convId = participants.join(':');
    
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
  await loadData();
  
  for (const msg of messages) {
    if (
      (msg.from === participant1 && msg.to === participant2) ||
      (msg.from === participant2 && msg.to === participant1)
    ) {
      msg.read = true;
    }
  }
  
  await saveMessages();
}

// --- Agent Registry ---

export async function registerAgent(agent: AgentInfo): Promise<void> {
  await loadData();
  agents.set(agent.id, agent);
  await saveAgents();
}

export async function getAgent(id: string): Promise<AgentInfo | undefined> {
  await loadData();
  return agents.get(id);
}

export async function getAllAgents(): Promise<AgentInfo[]> {
  await loadData();
  return [...agents.values()];
}

export async function updateAgentStatus(id: string, status: AgentInfo['status']): Promise<void> {
  await loadData();
  const agent = agents.get(id);
  if (agent) {
    agent.status = status;
    await saveAgents();
  }
}

export async function removeAgent(id: string): Promise<void> {
  await loadData();
  agents.delete(id);
  await saveAgents();
}
