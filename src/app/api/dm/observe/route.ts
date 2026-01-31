/**
 * DM Observe API (Admin only)
 * 
 * GET /api/dm/observe - See all agent-to-agent DMs
 * 
 * Query params:
 *   - limit: max messages (default 100)
 *   - since: timestamp filter
 *   - agents: comma-separated agent IDs to filter
 *   - all: include broadcast/team chat messages (default false)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/chat/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const since = searchParams.get('since');
    const agentsFilter = searchParams.get('agents')?.split(',');
    const includeAll = searchParams.get('all') === 'true';
    
    // Get all messages
    const allMessages = await store.getAllMessages(limit * 2);
    
    // Filter to agent messages
    const humanIds = ['andrew', 'cale'];
    let dms = allMessages.filter(m => {
      // Must be FROM an agent (not human)
      if (humanIds.includes(m.from)) return false;
      
      // If includeAll, show everything from agents
      if (includeAll) return true;
      
      // Otherwise, only show agent-to-agent DMs (exclude broadcast/group)
      return !humanIds.includes(m.to) && 
             m.to !== 'broadcast' && 
             !m.to.startsWith('group-');
    });
    
    // Apply timestamp filter
    if (since) {
      dms = dms.filter(m => m.timestamp > parseInt(since));
    }
    
    // Apply agents filter
    if (agentsFilter && agentsFilter.length > 0) {
      dms = dms.filter(m => 
        agentsFilter.includes(m.from) || agentsFilter.includes(m.to)
      );
    }
    
    // Get agent names for context
    const agents = await store.getAllAgents();
    const agentNames: Record<string, string> = {};
    for (const agent of agents) {
      agentNames[agent.id] = agent.name;
    }
    
    // Format messages with names
    const formattedMessages = dms.slice(-limit).map(m => ({
      ...m,
      fromName: agentNames[m.from] || m.from,
      toName: agentNames[m.to] || m.to,
    }));
    
    // Group by conversation
    const conversations: Record<string, typeof formattedMessages> = {};
    for (const msg of formattedMessages) {
      const participants = [msg.from, msg.to].sort();
      const convKey = participants.join('-');
      if (!conversations[convKey]) {
        conversations[convKey] = [];
      }
      conversations[convKey].push(msg);
    }
    
    return NextResponse.json({
      totalMessages: formattedMessages.length,
      conversations: Object.entries(conversations).map(([key, msgs]) => ({
        participants: key.split('-'),
        participantNames: key.split('-').map(id => agentNames[id] || id),
        messages: msgs.sort((a, b) => a.timestamp - b.timestamp),
        lastActivity: Math.max(...msgs.map(m => m.timestamp)),
      })).sort((a, b) => b.lastActivity - a.lastActivity),
      latestTimestamp: formattedMessages.length > 0
        ? Math.max(...formattedMessages.map(m => m.timestamp))
        : null,
    });
  } catch (error) {
    console.error('Observe DMs error:', error);
    return NextResponse.json(
      { error: 'Failed to observe DMs', details: String(error) },
      { status: 500 }
    );
  }
}
