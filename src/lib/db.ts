/**
 * Mission Control Database - Convex Client
 * 
 * This file provides a thin wrapper around the Convex client
 * for backward compatibility during the migration.
 * 
 * New code should use the Convex hooks directly:
 * - useQuery(api.tasks.getAll)
 * - useMutation(api.tasks.create)
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

// Create Convex client if URL is available
export const convex = CONVEX_URL ? new ConvexHttpClient(CONVEX_URL) : null;

// Re-export types for backward compatibility
export type TaskStatus = 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageType = 'comment' | 'system' | 'activity';
export type ActivityTargetType = 'task' | 'message' | 'document' | 'agent';
export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'archived';
export type NotificationType = 'mention' | 'assignment' | 'comment' | 'status_change' | 'system';
export type SubscriptionTargetType = 'task' | 'document';

// Types (matching Convex schema)
export interface Agent {
  _id: string;
  _creationTime: number;
  id: string;
  name: string;
  role: string;
  emoji?: string;
  status: string;
  purpose?: string;
  specialties?: string[];
  parentId?: string;
  reportsTo?: string;
  level: string;
  workspace?: string;
  sessionKey?: string;
  heartbeatCron?: string;
  tools?: string[];
}

export interface Task {
  _id: string;
  _creationTime: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;
  assignedTo?: string;
  dueDate?: number;
  tags?: string[];
  completedAt?: number;
}

export interface Message {
  _id: string;
  _creationTime: number;
  taskId?: string;
  authorId: string;
  authorType: 'agent' | 'human';
  content: string;
  messageType: MessageType;
  parentId?: string;
  mentions?: string[];
}

export interface Activity {
  _id: string;
  _creationTime: number;
  actorId: string;
  actorType: 'agent' | 'human' | 'system';
  action: string;
  targetType: ActivityTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface Document {
  _id: string;
  _creationTime: number;
  title: string;
  content: string;
  contentType: 'markdown' | 'text' | 'json';
  authorId: string;
  taskId?: string;
  status: DocumentStatus;
  version: number;
  tags?: string[];
}

export interface Notification {
  _id: string;
  _creationTime: number;
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  targetType: string;
  targetId: string;
  read: boolean;
}

export interface Subscription {
  _id: string;
  _creationTime: number;
  subscriberId: string;
  targetType: SubscriptionTargetType;
  targetId: string;
  autoSubscribed: boolean;
}

// Legacy compatibility functions (deprecated - use Convex hooks directly)
export async function sql<T>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  console.warn('[db.ts] sql() is deprecated. Use Convex hooks directly.');
  return [];
}

export async function query<T>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  console.warn('[db.ts] query() is deprecated. Use Convex hooks directly.');
  return [];
}

export async function initMissionControlDb(): Promise<void> {
  console.log('[MissionControl] Using Convex - no initialization needed');
}

export async function syncAgentsFromRoster(
  agents: Array<{
    id: string;
    name: string;
    role: string;
    reportsTo?: string;
    sessionKey?: string;
    workspace?: string;
    heartbeatCron?: string;
    level?: string;
    tools?: string[];
  }>
): Promise<void> {
  if (!convex) {
    console.warn('[MissionControl] Convex not initialized');
    return;
  }
  
  // Import dynamically to avoid issues with SSR
  const { api } = await import("../../convex/_generated/api");
  await convex.mutation(api.agents.syncFromRoster, { agents });
  console.log(`[MissionControl] Synced ${agents.length} agents to Convex`);
}

// Keep for backward compatibility
export const pool = null;
