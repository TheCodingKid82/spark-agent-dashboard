import { NextResponse } from 'next/server';
import { getRecord, updateRecord } from '@/lib/provisioning/store';
import { getServiceStatus } from '@/lib/provisioning/railway';
import { checkAgentHealth } from '@/lib/provisioning/gateway-config';

/**
 * GET /api/agents/:agentId/status — Get live agent status
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

  const result: Record<string, unknown> = {
    agentId,
    agentName: record.agentName,
  };

  // Railway service status
  if (record.railwayServiceId) {
    const serviceResult = await getServiceStatus(record.railwayServiceId);
    if (serviceResult.success && serviceResult.data) {
      result.railway = {
        status: serviceResult.data.status,
        domain: serviceResult.data.domain,
      };
    }
  }

  // Gateway health check
  if (record.gatewayUrl && record.gatewayToken) {
    const health = await checkAgentHealth(record.gatewayUrl, record.gatewayToken);
    result.gateway = {
      healthy: health.healthy,
      status: health.status,
      error: health.error,
    };

    // Update last health check
    updateRecord(agentId, {
      lastHealthCheck: new Date().toISOString(),
      healthStatus: health.healthy ? 'healthy' : 'unhealthy',
    });
  }

  return NextResponse.json({ success: true, ...result });
}
