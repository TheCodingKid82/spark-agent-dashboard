import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/provisioning/store';
import { listServices } from '@/lib/provisioning/railway';

// Services to exclude from agent list (infrastructure, not agents)
const EXCLUDED_SERVICES = ['command-center'];

// Helper to fetch env vars from Railway for a service
async function getServiceEnvVars(serviceId: string): Promise<Record<string, string>> {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || '7ae32d1d-c474-450b-b7f5-6f16e5d875cd';
  
  if (!token || !projectId) return {};
  
  try {
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query($projectId: String!, $serviceId: String!, $environmentId: String!) {
          variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
        }`,
        variables: { projectId, serviceId, environmentId },
      }),
    });
    const data = await res.json();
    return data?.data?.variables || {};
  } catch {
    return {};
  }
}

/**
 * GET /api/agents — List all provisioned agents with live status
 * 
 * Primary source of truth: Railway services
 * Secondary enrichment: local provisioning store + Railway env vars
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
    const agentPromises = railwayServices
      .filter(svc => !EXCLUDED_SERVICES.includes(svc.name))
      .map(async (svc) => {
        // Try to find matching store record
        const record = recordsByServiceId.get(svc.id) || recordsByName.get(svc.name);
        
        // If no token in store, fetch from Railway env vars
        let gatewayToken = record?.gatewayToken;
        let agentName = record?.agentName;
        let agentRole = record?.agentRole || record?.roleTemplate;
        let agentPurpose = record?.agentPurpose;
        
        if (!gatewayToken || !agentName) {
          const envVars = await getServiceEnvVars(svc.id);
          gatewayToken = gatewayToken || envVars.CLAWDBOT_GATEWAY_TOKEN;
          agentName = agentName || envVars.AGENT_NAME || svc.name.charAt(0).toUpperCase() + svc.name.slice(1);
          agentRole = agentRole || envVars.AGENT_ROLE;
          agentPurpose = agentPurpose || envVars.AGENT_PURPOSE;
        }
        
        return {
          agentId: record?.agentId || svc.name,
          agentName,
          agentRole: agentRole || 'Agent',
          agentPurpose,
          roleTemplate: record?.roleTemplate,
          railwayServiceId: svc.id,
          railwayProjectId: process.env.RAILWAY_PROJECT_ID,
          domain: svc.domain,
          gatewayUrl: svc.domain ? `https://${svc.domain}` : undefined,
          gatewayToken,
          liveStatus: svc.status,
          provisionedAt: record?.provisionedAt,
          status: record?.status || (svc.status === 'SUCCESS' ? 'complete' : 'unknown'),
        };
      });

    const agents = await Promise.all(agentPromises);

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
