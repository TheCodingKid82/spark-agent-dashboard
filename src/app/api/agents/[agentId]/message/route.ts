import { NextResponse } from 'next/server';

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

// Find agent service by name from Railway
async function findAgentService(agentId: string) {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  
  if (!token || !projectId) return null;
  
  try {
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query($projectId: String!) {
          project(id: $projectId) {
            services {
              edges {
                node {
                  id
                  name
                  deployments(first: 1) {
                    edges {
                      node {
                        staticUrl
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        variables: { projectId },
      }),
    });
    const data = await res.json();
    const services = data?.data?.project?.services?.edges || [];
    
    // Find matching service (case-insensitive)
    const service = services.find((s: any) => 
      s.node.name.toLowerCase() === agentId.toLowerCase()
    );
    
    if (!service) return null;
    
    const domain = service.node.deployments?.edges?.[0]?.node?.staticUrl;
    return {
      id: service.node.id,
      name: service.node.name,
      domain,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/agents/:agentId/message — Send a message to an agent
 * Fetches agent info from Railway directly
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  
  // Find agent in Railway
  const service = await findAgentService(agentId);
  
  if (!service) {
    return NextResponse.json({ error: `Agent ${agentId} not found in Railway` }, { status: 404 });
  }
  
  // Get gateway token from env vars
  const envVars = await getServiceEnvVars(service.id);
  const gatewayToken = envVars.CLAWDBOT_GATEWAY_TOKEN || envVars.GATEWAY_TOKEN;
  const gatewayUrl = service.domain ? `https://${service.domain}` : null;
  
  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json(
      { error: `Agent ${agentId} gateway not configured (url: ${!!gatewayUrl}, token: ${!!gatewayToken})` },
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
  
  // Send message to agent via Clawdbot API
  try {
    const response = await fetch(`${gatewayUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: 'clawdbot',
        input: message,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ success: false, error }, { status: response.status });
    }
    
    const result = await response.json();
    return NextResponse.json({
      success: true,
      agentId,
      agentName: service.name,
      response: result,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
