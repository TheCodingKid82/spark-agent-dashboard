/**
 * POST /api/agents/refresh
 * 
 * Refresh all agent tokens from Railway env vars and update the chat store.
 */

import { NextResponse } from 'next/server';
import { registerAgent } from '@/lib/chat/store';

const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID || '25985985-f53d-4c2e-a9ff-c23e09716643';
const ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID || '7ae32d1d-c474-450b-b7f5-6f16e5d875cd';

async function railwayQuery(query: string, variables: Record<string, unknown>) {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export async function POST() {
  if (!RAILWAY_TOKEN) {
    return NextResponse.json({ error: 'RAILWAY_API_TOKEN not configured' }, { status: 500 });
  }

  try {
    // Get all services
    const servicesData = await railwayQuery(`
      query($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                deployments(first: 1) {
                  edges { node { staticUrl } }
                }
              }
            }
          }
        }
      }
    `, { projectId: PROJECT_ID });

    const services = servicesData?.data?.project?.services?.edges || [];
    const agentServices = services.filter((s: any) => {
      const name = s.node.name.toLowerCase();
      return ['atlas', 'apollo', 'artemis', 'maia', 'orpheus', 'callisto', 'iris'].includes(name);
    });

    const updated: string[] = [];
    const errors: string[] = [];

    for (const service of agentServices) {
      const name = service.node.name;
      const serviceId = service.node.id;
      const domain = service.node.deployments?.edges?.[0]?.node?.staticUrl;

      if (!domain) {
        errors.push(`${name}: no domain`);
        continue;
      }

      // Get env vars
      const varsData = await railwayQuery(`
        query($projectId: String!, $serviceId: String!, $environmentId: String!) {
          variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
        }
      `, { projectId: PROJECT_ID, serviceId, environmentId: ENVIRONMENT_ID });

      const vars = varsData?.data?.variables || {};
      const gatewayToken = vars.CLAWDBOT_GATEWAY_TOKEN;
      const agentRole = vars.AGENT_ROLE || 'Agent';

      if (!gatewayToken) {
        errors.push(`${name}: no token`);
        continue;
      }

      // Register in chat store
      await registerAgent({
        id: name.toLowerCase(),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        role: agentRole,
        gatewayUrl: `https://${domain}`,
        gatewayToken,
        status: 'online',
      });

      updated.push(`${name}: ${gatewayToken.slice(0, 8)}...`);
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
