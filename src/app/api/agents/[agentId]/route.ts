import { NextResponse } from 'next/server';
import { getRecord, deleteRecord } from '@/lib/provisioning/store';
import { getServiceStatus, deleteService } from '@/lib/provisioning/railway';
import { checkAgentHealth } from '@/lib/provisioning/gateway-config';

/**
 * GET /api/agents/:agentId — Get full agent details with live status
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const record = getRecord(agentId);

  if (!record) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Get live Railway status
  let liveStatus = 'UNKNOWN';
  let liveDomain: string | undefined;
  if (record.railwayServiceId) {
    const railwayResult = await getServiceStatus(record.railwayServiceId);
    if (railwayResult.success && railwayResult.data) {
      liveStatus = railwayResult.data.status;
      liveDomain = railwayResult.data.domain;
    }
  }

  // Health check
  let health = { healthy: false, error: 'Not deployed' };
  if (record.gatewayUrl && record.gatewayToken) {
    health = await checkAgentHealth(record.gatewayUrl, record.gatewayToken);
  }

  return NextResponse.json({
    success: true,
    agent: {
      ...record,
      liveStatus,
      liveDomain,
      health,
    },
  });
}

/**
 * DELETE /api/agents/:agentId — Delete an agent (service + record)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const record = getRecord(agentId);

  if (!record) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Delete Railway service if exists
  if (record.railwayServiceId && !record.isMock) {
    try {
      await deleteService(record.railwayServiceId);
    } catch (error) {
      // Continue with record deletion even if Railway fails
      console.error('Failed to delete Railway service:', error);
    }
  }

  // Delete from store
  deleteRecord(agentId);

  return NextResponse.json({
    success: true,
    message: `Agent ${record.agentName} deleted`,
  });
}
