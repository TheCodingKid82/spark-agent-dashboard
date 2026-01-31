/**
 * Agent DM API
 * 
 * POST /api/dm - Send a DM to another agent
 * GET /api/dm?agent=agentId&since=timestamp - Poll for incoming DMs
 */

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/chat/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent');
    const since = searchParams.get('since');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing required param: agent' },
        { status: 400 }
      );
    }
    
    // Get all DMs involving this agent
    const messages = await store.getMessages(agentId, undefined, limit);
    
    // Filter to only agent-to-agent DMs (exclude andrew, broadcast, group)
    const humanIds = ['andrew', 'cale'];
    const dms = messages.filter(m => 
      !humanIds.includes(m.from) && 
      !humanIds.includes(m.to) &&
      m.to !== 'broadcast' &&
      !m.to.startsWith('group')
    );
    
    // Filter by timestamp if provided
    const filtered = since 
      ? dms.filter(m => m.timestamp > parseInt(since))
      : dms;
    
    return NextResponse.json({
      agentId,
      messages: filtered,
      latestTimestamp: filtered.length > 0 
        ? filtered[filtered.length - 1].timestamp 
        : null,
    });
  } catch (error) {
    console.error('Get DMs error:', error);
    return NextResponse.json(
      { error: 'Failed to get DMs', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, content, notifyAgent = true } = body;
    
    if (!from || !to || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, content' },
        { status: 400 }
      );
    }
    
    // Don't allow DMing humans through this endpoint
    const humanIds = ['andrew', 'cale'];
    if (humanIds.includes(to)) {
      return NextResponse.json(
        { error: 'Use escalation for human contact, not DM' },
        { status: 400 }
      );
    }
    
    // Store the message
    const message = await store.addMessage({
      from,
      to,
      content,
      type: 'dm',
    });
    
    // If notifyAgent, send to their gateway
    let agentResponse: string | undefined;
    
    if (notifyAgent) {
      const targetAgent = await store.getAgent(to);
      const fromAgent = await store.getAgent(from);
      
      if (targetAgent) {
        try {
          const baseUrl = targetAgent.gatewayUrl.startsWith('http') 
            ? targetAgent.gatewayUrl 
            : `https://${targetAgent.gatewayUrl}`;
          
          const fromName = fromAgent?.name || from;
          const sessionKey = `dm:${from}:${to}`;
          
          const dmMessage = `📩 PRIVATE DM from ${fromName}:

${content}

---
This is a private agent-to-agent message. Reply naturally.
To respond, POST to /api/dm with from="${to}" and to="${from}".`;
          
          const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${targetAgent.gatewayToken}`,
            },
            body: JSON.stringify({
              model: 'anthropic/claude-opus-4-5',
              messages: [{ role: 'user', content: dmMessage }],
              user: sessionKey,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            agentResponse = data.choices?.[0]?.message?.content;
            
            // Store the response
            if (agentResponse && agentResponse.trim().length > 5) {
              await store.addMessage({
                from: to,
                to: from,
                content: agentResponse,
                type: 'dm',
              });
            }
          }
        } catch (error) {
          console.error('Failed to notify agent:', error);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message,
      agentResponse,
    });
  } catch (error) {
    console.error('Send DM error:', error);
    return NextResponse.json(
      { error: 'Failed to send DM', details: String(error) },
      { status: 500 }
    );
  }
}
