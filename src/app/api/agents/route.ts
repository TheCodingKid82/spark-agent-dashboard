import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/provisioning/store';
import { listServices } from '@/lib/provisioning/railway';

/**
 * GET /api/agents — List all provisioned agents with live status
 */
export async function GET() {
  try {
    const records = getAllRecords();

    // Get live Railway status
    const railwayResult = await listServices();
    const railwayServices = railwayResult.success ? (railwayResult.data || []) : [];

    // Merge store records with live Railway data
    const agents = records.map(record => {
      const liveService = railwayServices.find(s => s.id === record.railwayServiceId);
      return {
        ...record,
        liveStatus: liveService?.status || 'UNKNOWN',
        liveDomain: liveService?.domain || record.domain,
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
