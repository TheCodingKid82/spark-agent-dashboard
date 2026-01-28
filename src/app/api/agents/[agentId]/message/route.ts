import { NextResponse } from 'next/server';
import { getRecord } from '@/lib/provisioning/store';
import { sendAgentMessage } from '@/lib/provisioning/gateway-config';

/**
 * POST /api/agents/:agentId/message — Send a message to an agent
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

  if (!record.gatewayUrl || !record.gatewayToken) {
    return NextResponse.json(
      { error: 'Agent gateway not configured' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { message } = body;

  if (!message) {
    return NextResponse.json(
      { error: 'message is required' },
      { status: 400 }
    );
  }

  const result = await sendAgentMessage(
    record.gatewayUrl,
    record.gatewayToken,
    message,
  );

  return NextResponse.json({
    success: result.success,
    error: result.error,
    agentName: record.agentName,
  });
}
