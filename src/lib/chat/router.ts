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
  fromId?: string,
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    // Format the message with sender context
    const formattedMessage = fromAgent
      ? `[Message from ${fromAgent}]: ${message}`
      : message;

    // gatewayUrl already includes protocol (https://...)
    const baseUrl = agent.gatewayUrl.startsWith('http') ? agent.gatewayUrl : `https://${agent.gatewayUrl}`;
    
    // Create a consistent session key based on sender
    // This ensures the same sender always gets the same session
    const sessionKey = fromId 
      ? `command-center:${fromId}:${agent.id}`
      : `command-center:default:${agent.id}`;
    
    // Use Clawdbot's OpenResponses API endpoint
    const response = await fetch(`${baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agent.gatewayToken}`,
        'x-clawdbot-agent-id': 'main',
        'x-clawdbot-session-key': sessionKey,
      },
      body: JSON.stringify({
        model: 'clawdbot:main',
        input: formattedMessage,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Gateway error: ${response.status} - ${text}` };
    }

    const data = await response.json();
    
    // Extract text from OpenResponses format
    let responseText = '';
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') {
              responseText += content.text;
            }
          }
        }
      }
    }
    
    return { success: true, response: responseText || 'No response' };
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

    const result = await sendToGateway(agent, content, fromName, from);
    
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

  // Broadcast to all agents (Team Chat)
  if (to === 'broadcast') {
    const agents = await store.getAllAgents();
    
    // Get recent team chat history for context
    const recentMessages = await store.getBroadcastMessages(10);
    
    // Build conversation context
    const agentNames = agents.map(a => a.name).join(', ');
    let conversationHistory = '';
    if (recentMessages.length > 1) {
      // Skip the message we just added
      const previousMessages = recentMessages.slice(0, -1).slice(-5);
      if (previousMessages.length > 0) {
        conversationHistory = '\n\n--- Recent Team Chat History ---\n' +
          previousMessages.map(m => {
            const senderName = m.from === 'andrew' ? 'Andrew' : 
              agents.find(a => a.id === m.from)?.name || m.from;
            return `${senderName}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`;
          }).join('\n') +
          '\n--- End History ---\n';
      }
    }
    
    // Format the team chat message
    const senderName = from === 'andrew' ? 'Andrew (Co-founder)' : 
      (agents.find(a => a.id === from)?.name || from);
    
    const teamChatMessage = `📢 TEAM CHAT (All Agents Present: ${agentNames})
${conversationHistory}
${senderName}: ${content}

---
TEAM CHAT RULES:
- This is a group chat. Everyone can see everything.
- DO NOT reply unless: you're directly addressed, asked a question, or have something specifically relevant to add.
- If the message is general or for someone else, reply with just: [no response needed]
- If you're mentioned by name or role, respond helpfully.
- Keep responses concise. This is chat, not a report.
- React naturally like you would in a real team Slack channel.`;
    
    // Send to all agents and collect responses
    const responses: { agent: string; response: string }[] = [];
    
    for (const agent of agents) {
      const result = await sendToGateway(agent, teamChatMessage, senderName, from);
      if (result.success && result.response) {
        // Skip "[no response needed]" or similar non-responses
        const response = result.response.trim();
        const isNoResponse = response.toLowerCase().includes('[no response needed]') ||
                            response.toLowerCase().includes('no response needed') ||
                            response === '' ||
                            response.length < 5;
        
        if (!isNoResponse) {
          responses.push({ agent: agent.name, response: response });
          
          // Store each agent's response as a broadcast message
          await store.addMessage({
            from: agent.id,
            to: 'broadcast',
            content: response,
            type: 'text',
          });
        }
      }
    }
    
    return {
      success: true,
      messageId: sentMessage.id,
      teamResponses: responses,
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
