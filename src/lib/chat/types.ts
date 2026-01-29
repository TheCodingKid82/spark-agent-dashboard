/**
 * Chat System Types
 * 
 * Inter-agent and human-agent messaging infrastructure
 */

export interface ChatMessage {
  id: string;
  timestamp: number;
  from: string;        // Agent ID or 'andrew' or 'system'
  to: string;          // Agent ID or 'andrew' or 'broadcast'
  content: string;
  type: 'text' | 'task' | 'report' | 'escalation';
  metadata?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    replyTo?: string;
    taskId?: string;
  };
  read?: boolean;
}

export interface Conversation {
  id: string;                    // e.g., "atlas:apollo" or "andrew:atlas"
  participants: string[];
  lastMessage: ChatMessage;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  role?: string;
  purpose?: string;
  gatewayUrl: string;
  gatewayToken: string;
  status?: 'online' | 'offline' | 'busy' | 'unknown';
  capabilities?: string[];
  lastSeen?: number;
}

export interface TeamRoster {
  agents: AgentInfo[];
  henry: {
    name: string;
    role: string;
    contact: string;  // How to reach Henry
  };
  andrew: {
    name: string;
    role: string;
    contact: string;  // When to escalate
  };
}

export interface SendMessageRequest {
  from: string;
  to: string;
  content: string;
  type?: ChatMessage['type'];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  agentResponse?: string;  // If agent responds immediately
  teamResponses?: { agent: string; response: string }[];  // Team chat responses
}
