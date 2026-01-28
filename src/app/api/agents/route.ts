import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/provisioning/store';
import { listServices } from '@/lib/provisioning/railway';

// Services to exclude from agent list (infrastructure, not agents)
const EXCLUDED_SERVICES = ['command-center'];

/**
 * GET /api/agents — List all provisioned agents with live status
 * 
 * Primary source of truth: Railway services
 * Secondary enrichment: local provisioning store
 */
export async function GET() {
  try {
    // Get live services from Railway (source of truth)
    const railwayResult = await listServices();
    const railwayServices = railwayResult.success ? (railwayResult.data || []) : [];

    // Get store records for additional metadata
    const records = getAllRecords();
    const recordsByServiceId = new Map(
      records.filter(r => r.railwayServiceId).map(r => [r.railwayServiceId, r])
    );
    const recordsByName = new Map(
      records.map(r => [r.agentName.toLowerCase().replace(/\s+/g, '-'), r])
    );

    // Build agent list from Railway services
    const agents = railwayServices
      .filter(svc => !EXCLUDED_SERVICES.includes(svc.name))
      .map(svc => {
        // Try to find matching store record
        const record = recordsByServiceId.get(svc.id) || recordsByName.get(svc.name);
        
        return {
          agentId: record?.agentId || svc.name,
          agentName: record?.agentName || svc.name.charAt(0).toUpperCase() + svc.name.slice(1),
          agentRole: record?.agentRole || record?.roleTemplate || 'Agent',
          agentPurpose: record?.agentPurpose,
          roleTemplate: record?.roleTemplate,
          railwayServiceId: svc.id,
          railwayProjectId: record?.railwayProjectId,
          domain: svc.domain,
          gatewayUrl: svc.domain ? `https://${svc.domain}` : undefined,
          gatewayToken: record?.gatewayToken,
          liveStatus: svc.status,
          provisionedAt: record?.provisionedAt,
          status: record?.status || (svc.status === 'SUCCESS' ? 'complete' : 'unknown'),
        };
      });

    return NextResponse.json({
      success: true,
      agents,
      totalCount: agents.length,
      activeCount: agents.filter(a => a.liveStatus === 'SUCCESS').length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to list agents: ${String(error)}` },
      { status: 500 }
    );
  }
}
