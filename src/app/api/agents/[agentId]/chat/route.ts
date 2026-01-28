import { NextResponse } from 'next/server';
import { getRecord } from '@/lib/provisioning/store';

interface ChatRequest {
  message: string;
  sessionKey?: string;
}

/**
 * POST /api/agents/[agentId]/chat — Send a message to an agent's gateway
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = (await request.json()) as ChatRequest;
    const { message, sessionKey } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Get agent record to find gateway info
    const record = getRecord(agentId);
    
    // If no record, try to get gateway info from Railway env vars
    let gatewayUrl = record?.gatewayUrl;
    let gatewayToken = record?.gatewayToken;

    // Fallback: query Railway for the service's env vars
    if (!gatewayUrl || !gatewayToken) {
      const railwayToken = process.env.RAILWAY_API_TOKEN;
      const projectId = process.env.RAILWAY_PROJECT_ID;
      const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || '7ae32d1d-c474-450b-b7f5-6f16e5d875cd';

      if (railwayToken && projectId) {
        // Find the service by name
        const servicesRes = await fetch('https://backboard.railway.com/graphql/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${railwayToken}`,
          },
          body: JSON.stringify({
            query: `query($projectId: String!) {
              project(id: $projectId) {
                services {
                  edges {
                    node {
                      id
                      name
                      serviceInstances {
                        edges {
                          node {
                            domains { serviceDomains { domain } }
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

        const servicesData = await servicesRes.json();
        const services = servicesData?.data?.project?.services?.edges || [];
        const service = services.find((s: { node: { name: string } }) => 
          s.node.name.toLowerCase() === agentId.toLowerCase()
        );

        if (service) {
          const domain = service.node.serviceInstances?.edges?.[0]?.node?.domains?.serviceDomains?.[0]?.domain;
          if (domain) {
            gatewayUrl = `https://${domain}`;
          }

          // Get env vars to find the token
          const varsRes = await fetch('https://backboard.railway.com/graphql/v2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${railwayToken}`,
            },
            body: JSON.stringify({
              query: `query($projectId: String!, $serviceId: String!, $environmentId: String!) {
                variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
              }`,
              variables: { projectId, serviceId: service.node.id, environmentId },
            }),
          });

          const varsData = await varsRes.json();
          const vars = varsData?.data?.variables || {};
          gatewayToken = vars.CLAWDBOT_GATEWAY_TOKEN;
        }
      }
    }

    if (!gatewayUrl || !gatewayToken) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found or gateway info missing` },
        { status: 404 }
      );
    }

    // Send message to the agent's gateway using the OpenResponses API
    const agentRes = await fetch(`${gatewayUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        'x-clawdbot-agent-id': 'main',
        ...(sessionKey ? { 'x-clawdbot-session-key': sessionKey } : {}),
      },
      body: JSON.stringify({
        model: 'clawdbot',
        input: message,
        user: 'dashboard', // Use stable session key
      }),
    });

    if (!agentRes.ok) {
      const errorText = await agentRes.text();
      
      // Check if the endpoint is not enabled
      if (agentRes.status === 404 || agentRes.status === 405) {
        return NextResponse.json(
          { 
            error: 'Agent gateway API not enabled. The agent needs gateway.http.endpoints.responses.enabled=true in its config.',
            details: errorText,
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: `Gateway error: ${agentRes.status}`, details: errorText },
        { status: agentRes.status }
      );
    }

    const response = await agentRes.json();

    // Extract the output text from the OpenResponses format
    let outputText = '';
    if (response.output) {
      for (const item of response.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') {
              outputText += content.text;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      agentId,
      response: outputText || response,
      raw: response,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to chat with agent: ${String(error)}` },
      { status: 500 }
    );
  }
}
