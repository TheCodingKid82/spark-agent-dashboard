import { NextResponse } from 'next/server';
import { getRecord, deleteRecord } from '@/lib/provisioning/store';

/**
 * GET /api/agents/:agentId — Get agent details
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

  return NextResponse.json({ success: true, agent: record });
}

/**
 * DELETE /api/agents/:agentId — Remove agent from dashboard
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const deleted = deleteRecord(agentId);

  if (!deleted) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: `Agent ${agentId} removed from dashboard` });
}
