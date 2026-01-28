/**
 * GET /api/chat/team
 * 
 * Get team roster - all agents and their info.
 * This is what agents use to know who they can talk to.
 * 
 * POST /api/chat/team
 * 
 * Register or update an agent in the team roster.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/chat/store';
import { getTeamRoster, pingAllAgents } from '@/lib/chat/router';
import { AgentInfo } from '@/lib/chat/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ping = searchParams.get('ping') === 'true';

    // Optionally ping all agents to update status
    if (ping) {
      await pingAllAgents();
    }

    const roster = await getTeamRoster();
    return NextResponse.json(roster);
  } catch (error) {
    console.error('Team roster error:', error);
    return NextResponse.json(
      { error: 'Failed to get team roster', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const agent: AgentInfo = await request.json();
    
    if (!agent.id || !agent.name || !agent.gatewayUrl || !agent.gatewayToken) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, gatewayUrl, gatewayToken' },
        { status: 400 }
      );
    }

    await store.registerAgent({
      ...agent,
      status: agent.status || 'online',
    });

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('Agent registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register agent', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');
    
    if (!agentId) {
      return NextResponse.json({ error: 'Agent id required' }, { status: 400 });
    }

    await store.removeAgent(agentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Agent removal error:', error);
    return NextResponse.json(
      { error: 'Failed to remove agent', details: String(error) },
      { status: 500 }
    );
  }
}
