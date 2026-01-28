import { NextResponse } from 'next/server';
import { getRecord, updateRecord } from '@/lib/provisioning/store';
import { redeployService } from '@/lib/provisioning/railway';

/**
 * POST /api/agents/:agentId/start — Start/redeploy an agent
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const record = getRecord(agentId);

  if (!record) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  if (!record.railwayServiceId) {
    return NextResponse.json({ error: 'No Railway service configured' }, { status: 400 });
  }

  const result = await redeployService(record.railwayServiceId);

  if (result.success) {
    updateRecord(agentId, { railwayDeploymentStatus: 'DEPLOYING' });
    return NextResponse.json({
      success: true,
      message: `Agent ${record.agentName} is redeploying`,
    });
  }

  return NextResponse.json({
    success: false,
    error: result.error,
  }, { status: 500 });
}
