/**
 * Chat Router
 * 
 * Routes messages to agents via their gateway API.
 * Handles agent-to-agent and human-to-agent messaging.
 */

import { ChatMessage, SendMessageRequest, SendMessageResponse, AgentInfo } from './types';
import * as store from './store';

// --- Gateway Communication ---

async function sendToGateway(
  agent: AgentInfo,
  message: string,
  fromAgent?: string,
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    // Format the message with sender context
    const formattedMessage = fromAgent
      ? `[Message from ${fromAgent}]: ${message}`
      : message;

    const response = await fetch(`https://${agent.gatewayUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agent.gatewayToken}`,
      },
      body: JSON.stringify({
        message: formattedMessage,
        sessionKey: 'main',  // Use main session
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Gateway error: ${response.status} - ${text}` };
    }

    const data = await response.json();
    return { success: true, response: data.response || data.message };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// --- Message Routing ---

export async function sendMessage(req: SendMessageRequest): Promise<SendMessageResponse> {
  const { from, to, content, type = 'text', priority = 'normal' } = req;

  // Store the outgoing message
  const sentMessage = await store.addMessage({
    from,
    to,
    content,
    type,
    metadata: { priority },
  });

  // If sending to an agent, route through their gateway
  if (to !== 'andrew' && to !== 'broadcast') {
    const agent = await store.getAgent(to);
    if (!agent) {
      return { success: false, error: `Agent '${to}' not found in registry` };
    }

    // Get sender name for context
    let fromName = from;
    if (from !== 'andrew') {
      const fromAgent = await store.getAgent(from);
      if (fromAgent) fromName = `${fromAgent.name} (${fromAgent.role})`;
    } else {
      fromName = 'Andrew (Founder)';
    }

    const result = await sendToGateway(agent, content, fromName);
    
    if (result.success && result.response) {
      // Store agent's response
      await store.addMessage({
        from: to,
        to: from,
        content: result.response,
        type: 'text',
      });
    }

    return {
      success: result.success,
      messageId: sentMessage.id,
      error: result.error,
      agentResponse: result.response,
    };
  }

  // If sending to Andrew (escalation)
  if (to === 'andrew') {
    // Just store the message - Andrew will see it in the dashboard
    // Could also trigger a notification here
    return {
      success: true,
      messageId: sentMessage.id,
    };
  }

  // Broadcast to all agents
  if (to === 'broadcast') {
    const agents = await store.getAllAgents();
    const results = await Promise.all(
      agents.map(agent => sendToGateway(agent, content, from))
    );
    
    const failures = results.filter(r => !r.success);
    return {
      success: failures.length === 0,
      messageId: sentMessage.id,
      error: failures.length > 0 ? `${failures.length} agents failed to receive` : undefined,
    };
  }

  return { success: false, error: 'Invalid recipient' };
}

// --- Agent Discovery ---

export async function getTeamRoster() {
  const agents = await store.getAllAgents();
  
  return {
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      purpose: a.purpose,
      status: a.status,
      capabilities: a.capabilities,
    })),
    henry: {
      name: 'Henry',
      role: 'COO Agent',
      contact: 'Via sessions_send or escalate through dashboard',
    },
    andrew: {
      name: 'Andrew Weir',
      role: 'Founder',
      contact: 'Escalate via dashboard for urgent/high-level decisions only',
    },
  };
}

// --- Health Check ---

export async function pingAgent(agentId: string): Promise<boolean> {
  const agent = await store.getAgent(agentId);
  if (!agent) return false;

  try {
    const response = await fetch(`https://${agent.gatewayUrl}/api/status`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${agent.gatewayToken}` },
    });
    const isOnline = response.ok;
    await store.updateAgentStatus(agentId, isOnline ? 'online' : 'offline');
    return isOnline;
  } catch {
    await store.updateAgentStatus(agentId, 'offline');
    return false;
  }
}

export async function pingAllAgents(): Promise<Map<string, boolean>> {
  const agents = await store.getAllAgents();
  const results = new Map<string, boolean>();
  
  await Promise.all(
    agents.map(async (agent) => {
      const online = await pingAgent(agent.id);
      results.set(agent.id, online);
    })
  );
  
  return results;
}
