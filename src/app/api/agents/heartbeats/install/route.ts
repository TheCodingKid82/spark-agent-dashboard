import { NextResponse } from 'next/server';
import { loadRoster } from '@/lib/agents/registry';
import { gatewayToolsInvoke } from '@/lib/gateway/client';

/**
 * POST /api/agents/heartbeats/install
 *
 * Installs (or re-installs) staggered heartbeat cron jobs inside the single local gateway.
 *
 * Implementation detail:
 * - We create an isolated cron job per agent.
 * - The cron job runs an agent turn that uses `sessions_send` to poke the agent sessionKey.
 */
export async function POST() {
  try {
    const roster = loadRoster();

    if (!roster.gateway.url || !roster.gateway.token) {
      return NextResponse.json(
        { error: 'Gateway not configured (HENRY_GATEWAY_URL/HENRY_GATEWAY_TOKEN)' },
        { status: 500 }
      );
    }

    const results: Array<{ agentId: string; ok: boolean; jobId?: string; error?: string }> = [];

    for (const agent of roster.agents) {
      if (!agent.heartbeatCron) {
        results.push({ agentId: agent.id, ok: false, error: 'Missing heartbeatCron in roster' });
        continue;
      }

      const job = {
        name: `heartbeat:${agent.id}`,
        schedule: {
          kind: 'cron',
          cron: agent.heartbeatCron,
          // Use gateway host timezone; can be overridden later.
        },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: {
          kind: 'agentTurn',
          message: [
            `You are the scheduler for ${agent.name} (${agent.id}).`,
            `Send a heartbeat wake message to session ${agent.sessionKey}.`,
            `Use sessions_send with timeoutSeconds=300 so the agent can run a full turn.`,
            `Message content: "[heartbeat] Follow your HEARTBEAT.md / WORKING.md. If nothing, reply HEARTBEAT_OK."`,
          ].join('\n'),
        },
      };

      try {
        const out = await gatewayToolsInvoke<{ ok?: boolean; jobId?: string; id?: string }>(
          { url: roster.gateway.url, token: roster.gateway.token },
          'cron',
          { action: 'add', job },
        );

        results.push({ agentId: agent.id, ok: true, jobId: (out as any).jobId || (out as any).id });
      } catch (e) {
        results.push({ agentId: agent.id, ok: false, error: String(e) });
      }
    }

    return NextResponse.json({ success: results.every(r => r.ok), results });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to install heartbeats: ${String(error)}` },
      { status: 500 }
    );
  }
}
