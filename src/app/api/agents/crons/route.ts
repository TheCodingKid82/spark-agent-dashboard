import { NextResponse } from 'next/server';

/**
 * GET /api/agents/crons — Get all agent cron job statuses from gateway
 */
export async function GET() {
  const gatewayUrl = process.env.HENRY_GATEWAY_URL;
  const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({ 
      error: 'Gateway not configured',
      crons: {} 
    });
  }

  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'cron',
        params: {
          action: 'list',
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ 
        error: 'Gateway unreachable',
        crons: {} 
      });
    }

    const data = await res.json();
    const jobs = data.result?.details?.jobs || data.jobs || [];
    
    // Map jobs by agent name (extracted from job name like "atlas-heartbeat")
    const cronsByAgent: Record<string, {
      jobId: string;
      lastRunAt: number | null;
      nextRunAt: number | null;
      lastStatus: string | null;
      enabled: boolean;
    }> = {};

    for (const job of jobs) {
      // Extract agent name from job name (e.g., "atlas-heartbeat" -> "atlas")
      const match = job.name?.match(/^(\w+)-heartbeat$/);
      if (match) {
        const agentId = match[1];
        cronsByAgent[agentId] = {
          jobId: job.id,
          lastRunAt: job.state?.lastRunAtMs || null,
          nextRunAt: job.state?.nextRunAtMs || null,
          lastStatus: job.state?.lastStatus || null,
          enabled: job.enabled ?? true,
        };
      }
    }

    return NextResponse.json({
      success: true,
      crons: cronsByAgent,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch cron status',
      details: String(error),
      crons: {},
    });
  }
}
