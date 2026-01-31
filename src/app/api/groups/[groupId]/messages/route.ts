/**
 * Group Messages API
 * 
 * GET /api/groups/[groupId]/messages?since=timestamp&limit=50
 *   - Get messages in a group, optionally since a timestamp
 *   - Used by agents to poll for new messages
 * 
 * POST /api/groups/[groupId]/messages
 *   - Post a message to the group
 *   - Can be from a human or an agent
 *   - If notifyAgents=true, broadcasts to other group members
 */

import { NextRequest, NextResponse } from 'next/server';
import * as groupStore from '@/lib/chat/group-store';
import * as store from '@/lib/chat/store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Verify group exists
    const group = await groupStore.getGroup(groupId);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    const messages = await groupStore.getGroupMessages(
      groupId,
      since ? parseInt(since) : undefined,
      limit
    );
    
    return NextResponse.json({
      groupId,
      groupName: group.name,
      members: group.members,
      messages,
      latestTimestamp: messages.length > 0 
        ? messages[messages.length - 1].timestamp 
        : null,
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    return NextResponse.json(
      { error: 'Failed to get messages', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const body = await request.json();
    const { from, content, notifyAgents = false } = body;
    
    if (!from || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: from, content' },
        { status: 400 }
      );
    }
    
    // Verify group exists
    const group = await groupStore.getGroup(groupId);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    // Verify sender is a member (or andrew who can message any group)
    if (from !== 'andrew' && !group.members.includes(from)) {
      return NextResponse.json(
        { error: 'Sender is not a member of this group' },
        { status: 403 }
      );
    }
    
    // Store the message
    const message = await groupStore.addGroupMessage({
      groupId,
      from,
      content,
    });
    
    // If notifyAgents is true, broadcast to other agents in the group
    let agentResponses: { agent: string; response: string }[] = [];
    
    if (notifyAgents) {
      const allAgents = await store.getAllAgents();
      const otherMembers = group.members.filter(m => m !== from);
      const targetAgents = allAgents.filter(a => otherMembers.includes(a.id));
      
      if (targetAgents.length > 0) {
        // Get recent group history for context
        const recentMessages = await groupStore.getGroupMessages(groupId, undefined, 10);
        
        // Build conversation context
        let conversationHistory = '';
        if (recentMessages.length > 1) {
          const previousMessages = recentMessages.slice(0, -1).slice(-5);
          if (previousMessages.length > 0) {
            conversationHistory = '\n\n--- Recent Group Chat History ---\n' +
              previousMessages.map(m => {
                const senderName = m.from === 'andrew' ? 'Andrew' : 
                  allAgents.find(a => a.id === m.from)?.name || m.from;
                return `${senderName}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`;
              }).join('\n') +
              '\n--- End History ---\n';
          }
        }
        
        // Format the group chat message
        const senderName = from === 'andrew' ? 'Andrew (Co-founder)' : 
          (allAgents.find(a => a.id === from)?.name || from);
        const memberNames = group.members.map(m => {
          if (m === 'andrew') return 'Andrew';
          return allAgents.find(a => a.id === m)?.name || m;
        }).join(', ');
        
        const groupChatMessage = `💬 GROUP CHAT: "${group.name}" (Members: ${memberNames})
${conversationHistory}
${senderName}: ${content}

---
GROUP CHAT RULES:
- This is a persistent group chat. All messages are saved.
- Respond if you're addressed, asked a question, or have relevant input.
- If the message doesn't need your input, reply with: [no response needed]
- Keep responses concise and relevant.
- You can initiate messages to this group anytime via POST /api/groups/${groupId}/messages`;
        
        // Send to group agents IN PARALLEL
        const agentResults = await Promise.all(
          targetAgents.map(async (agent) => {
            try {
              const baseUrl = agent.gatewayUrl.startsWith('http') ? agent.gatewayUrl : `https://${agent.gatewayUrl}`;
              const sessionKey = `group:${groupId}:${agent.id}`;
              
              const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${agent.gatewayToken}`,
                },
                body: JSON.stringify({
                  model: 'anthropic/claude-opus-4-5',
                  messages: [{ role: 'user', content: groupChatMessage }],
                  user: sessionKey,
                }),
              });
              
              if (!response.ok) return { agent, result: { success: false } };
              
              const data = await response.json();
              const responseText = data.choices?.[0]?.message?.content || '';
              
              return { agent, result: { success: true, response: responseText } };
            } catch (error) {
              return { agent, result: { success: false, error: String(error) } };
            }
          })
        );
        
        // Process responses and store them
        for (const { agent, result } of agentResults) {
          if (result.success && result.response) {
            const response = result.response.trim();
            const isNoResponse = response.toLowerCase().includes('[no response needed]') ||
                                response.toLowerCase().includes('no response needed') ||
                                response === '' ||
                                response.length < 5;
            
            if (!isNoResponse) {
              agentResponses.push({ agent: agent.name, response });
              
              // Store agent's response in group chat
              await groupStore.addGroupMessage({
                groupId,
                from: agent.id,
                content: response,
              });
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message,
      agentResponses: agentResponses.length > 0 ? agentResponses : undefined,
    });
  } catch (error) {
    console.error('Post group message error:', error);
    return NextResponse.json(
      { error: 'Failed to post message', details: String(error) },
      { status: 500 }
    );
  }
}
