import { NextResponse } from 'next/server';
import { listAgents } from '@/lib/agents/registry';

/**
 * GET /api/agents — List agents for the single-gateway, multi-session architecture.
 *
 * Source of truth: agent-roster.json (optionally overridden by env vars).
 */
export async function GET() {
  try {
    const agents = listAgents().map(a => ({
      agentId: a.id,
      agentName: a.name,
      agentRole: a.role,
      agentPurpose: a.purpose,
      emoji: a.emoji,
      sessionKey: a.sessionKey,
      heartbeatCron: a.heartbeatCron,
      status: 'configured',
      liveStatus: 'UNKNOWN',
    }));

    return NextResponse.json({
      success: true,
      agents,
      totalCount: agents.length,
      activeCount: agents.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to list agents: ${String(error)}` },
      { status: 500 }
    );
  }
}
