import { NextResponse } from 'next/server';
import { getRecord, updateRecord } from '@/lib/provisioning/store';
import { deleteService } from '@/lib/provisioning/railway';

/**
 * POST /api/agents/:agentId/stop — Stop an agent (deletes Railway service, keeps record)
 * Note: To fully delete, use DELETE /api/agents/:agentId
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
    return NextResponse.json({ error: 'No Railway service to stop' }, { status: 400 });
  }

  // Delete the Railway service (stops billing/resources)
  const result = await deleteService(record.railwayServiceId);

  if (result.success) {
    updateRecord(agentId, {
      railwayDeploymentStatus: 'stopped',
      healthStatus: 'stopped',
    });
    return NextResponse.json({
      success: true,
      message: `Agent ${record.agentName} stopped`,
    });
  }

  return NextResponse.json({
    success: false,
    error: result.error,
  }, { status: 500 });
}
