/**
 * Railway Integration Module
 * 
 * Deploys Clawdbot agents as services in the shared "Spark Studio Agents" project.
 * Uses serviceCreate + source.repo approach (proven working 2026-01-28).
 */

const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

// --- Types ---

interface RailwayResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  mock?: boolean;
}

interface ServiceInfo {
  serviceId: string;
  serviceName: string;
  domain: string;
  gatewayToken: string;
  projectId: string;
  status: string;
}

// --- Config ---

function getConfig() {
  // Start command that:
  // 1. Creates ~/.claude and ~/.clawdbot directories
  // 2. Writes Claude credentials.json with the setup token
  // 3. Writes Clawdbot config with trustedProxies for Railway
  // 4. Starts the Clawdbot gateway
  const defaultStartCommand = `sh -c '
    mkdir -p ~/.claude ~/.clawdbot &&
    echo "{\"claudeAiOauth\":{\"accessToken\":\"$ANTHROPIC_AUTH_TOKEN\",\"expiresAt\":9999999999999}}" > ~/.claude/.credentials.json &&
    echo "{\"gateway\":{\"mode\":\"local\",\"trustedProxies\":[\"100.64.0.0/10\",\"10.0.0.0/8\",\"172.16.0.0/12\",\"192.168.0.0/16\"],\"auth\":{\"mode\":\"token\",\"token\":\"$CLAWDBOT_GATEWAY_TOKEN\"}},\"agents\":{\"defaults\":{\"workspace\":\"/data/workspace\"}},\"wizard\":{\"lastRunAt\":\"2026-01-01T00:00:00.000Z\",\"lastRunCommand\":\"provision\"}}" > ~/.clawdbot/clawdbot.json &&
    node dist/index.js gateway --port 8080 --bind lan
  '`;
  
  return {
    token: process.env.RAILWAY_API_TOKEN || null,
    projectId: process.env.RAILWAY_PROJECT_ID || null,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '7ae32d1d-c474-450b-b7f5-6f16e5d875cd',
    workspaceId: process.env.RAILWAY_WORKSPACE_ID || null,
    sourceRepo: process.env.RAILWAY_SOURCE_REPO || 'clawdbot/clawdbot',
    startCommand: process.env.RAILWAY_START_COMMAND || defaultStartCommand,
  };
}

function isMockMode(): boolean {
  const config = getConfig();
  return !config.token || !config.projectId;
}

// --- GraphQL Helper ---

async function railwayQuery(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  const config = getConfig();
  if (!config.token) throw new Error('RAILWAY_API_TOKEN not configured');

  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Railway API error (${response.status}): ${text}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`Railway GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`);
  }

  return json.data;
}

// --- Utility ---

function generateGatewayToken(): string {
  const chars = 'abcdef0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function sanitizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

// --- Core Provisioning ---

/**
 * Deploy a new Clawdbot agent as a service in the shared project.
 * 
 * Steps:
 * 1. serviceCreate with source.repo (doesn't auto-build)
 * 2. serviceInstanceUpdate — set start command
 * 3. variableCollectionUpsert — push env vars
 * 4. volumeCreate — /data mount
 * 5. serviceDomainCreate — public URL
 * 6. serviceInstanceDeploy — trigger build (env vars already set!)
 */
export async function provisionFullStack(
  agentName: string,
  agentRole: string,
  agentPurpose: string,
  extraVars?: Record<string, string>,
): Promise<RailwayResult<ServiceInfo>> {
  if (isMockMode()) {
    const mockToken = generateGatewayToken();
    return {
      success: true,
      mock: true,
      data: {
        serviceId: `mock-svc-${Date.now()}`,
        serviceName: sanitizeServiceName(agentName),
        domain: `${sanitizeServiceName(agentName)}-production.up.railway.app`,
        gatewayToken: mockToken,
        projectId: 'mock-project',
        status: 'MOCK',
      },
    };
  }

  const config = getConfig();
  const serviceName = sanitizeServiceName(agentName);
  const gatewayToken = generateGatewayToken();

  try {
    // Step 1: Create the service with GitHub repo source
    const createData = await railwayQuery(`
      mutation($input: ServiceCreateInput!) {
        serviceCreate(input: $input) { id name }
      }
    `, {
      input: {
        projectId: config.projectId,
        name: serviceName,
        source: { repo: config.sourceRepo },
      },
    }) as { serviceCreate: { id: string; name: string } };

    const serviceId = createData.serviceCreate.id;

    // Step 2: Set start command
    await railwayQuery(`
      mutation($serviceId: String!, $input: ServiceInstanceUpdateInput!) {
        serviceInstanceUpdate(serviceId: $serviceId, input: $input)
      }
    `, {
      serviceId,
      input: { startCommand: config.startCommand },
    });

    // Step 3: Set environment variables (BEFORE triggering deploy)
    const setupPassword = generateGatewayToken();
    const envVars: Record<string, string> = {
      CLAWDBOT_STATE_DIR: '/data/.clawdbot',
      CLAWDBOT_WORKSPACE_DIR: '/data/workspace',
      RAILWAY_RUN_UID: '0',
      PORT: '8080',
      SETUP_PASSWORD: setupPassword,
      CLAWDBOT_GATEWAY_TOKEN: gatewayToken,
      AGENT_NAME: agentName,
      AGENT_ROLE: agentRole,
      AGENT_PURPOSE: agentPurpose,
      // Anthropic setup token for auto-pairing
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_SETUP_TOKEN || '',
      ...(extraVars || {}),
    };

    await railwayQuery(`
      mutation($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `, {
      input: {
        projectId: config.projectId,
        serviceId,
        environmentId: config.environmentId,
        variables: envVars,
      },
    });

    // Step 4: Create volume for persistent data
    await railwayQuery(`
      mutation($input: VolumeCreateInput!) {
        volumeCreate(input: $input) { id }
      }
    `, {
      input: {
        projectId: config.projectId,
        serviceId,
        environmentId: config.environmentId,
        mountPath: '/data',
      },
    });

    // Step 5: Create public domain
    const domainData = await railwayQuery(`
      mutation($input: ServiceDomainCreateInput!) {
        serviceDomainCreate(input: $input) { domain }
      }
    `, {
      input: {
        serviceId,
        environmentId: config.environmentId,
      },
    }) as { serviceDomainCreate: { domain: string } };

    const domain = domainData.serviceDomainCreate.domain;

    // Step 6: Trigger deployment (env vars are already set!)
    await railwayQuery(`
      mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `, {
      serviceId,
      environmentId: config.environmentId,
    });

    return {
      success: true,
      mock: false,
      data: {
        serviceId,
        serviceName,
        domain,
        gatewayToken,
        projectId: config.projectId!,
        status: 'DEPLOYING',
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// --- Status & Management ---

/**
 * Get deployment status for a specific service
 */
export async function getServiceStatus(serviceId: string): Promise<RailwayResult<{
  status: string;
  domain?: string;
  repo?: string;
}>> {
  if (isMockMode()) {
    return { success: true, mock: true, data: { status: 'SUCCESS', domain: 'mock.up.railway.app' } };
  }

  try {
    const config = getConfig();
    const data = await railwayQuery(`
      query($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                serviceInstances {
                  edges {
                    node {
                      source { repo image }
                      latestDeployment { id status }
                      domains { serviceDomains { domain } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, { projectId: config.projectId }) as { project: { services: { edges: Array<{ node: { id: string; name: string; serviceInstances: { edges: Array<{ node: { source: { repo: string }; latestDeployment: { status: string }; domains: { serviceDomains: Array<{ domain: string }> } } }> } } }> } } };

    const service = data.project.services.edges.find(e => e.node.id === serviceId);
    if (!service) return { success: true, data: { status: 'NOT_FOUND' } };

    const instance = service.node.serviceInstances.edges[0]?.node;
    if (!instance) return { success: true, data: { status: 'NO_INSTANCE' } };

    return {
      success: true,
      data: {
        status: instance.latestDeployment?.status || 'UNKNOWN',
        domain: instance.domains?.serviceDomains?.[0]?.domain,
        repo: instance.source?.repo,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * List all services in the project
 */
export async function listServices(): Promise<RailwayResult<Array<{
  id: string;
  name: string;
  status: string;
  domain?: string;
}>>> {
  if (isMockMode()) {
    return { success: true, mock: true, data: [] };
  }

  try {
    const config = getConfig();
    const data = await railwayQuery(`
      query($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                serviceInstances {
                  edges {
                    node {
                      latestDeployment { status }
                      domains { serviceDomains { domain } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, { projectId: config.projectId }) as { project: { services: { edges: Array<{ node: { id: string; name: string; serviceInstances: { edges: Array<{ node: { latestDeployment: { status: string }; domains: { serviceDomains: Array<{ domain: string }> } } }> } } }> } } };

    const services = data.project.services.edges.map(e => ({
      id: e.node.id,
      name: e.node.name,
      status: e.node.serviceInstances.edges[0]?.node?.latestDeployment?.status || 'UNKNOWN',
      domain: e.node.serviceInstances.edges[0]?.node?.domains?.serviceDomains?.[0]?.domain,
    }));

    return { success: true, data: services };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Redeploy an existing service
 */
export async function redeployService(serviceId: string): Promise<RailwayResult<boolean>> {
  if (isMockMode()) return { success: true, mock: true, data: true };

  try {
    const config = getConfig();
    await railwayQuery(`
      mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `, { serviceId, environmentId: config.environmentId });
    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Update environment variables on an existing service
 */
export async function updateServiceVars(
  serviceId: string,
  variables: Record<string, string>,
): Promise<RailwayResult<boolean>> {
  if (isMockMode()) return { success: true, mock: true, data: true };

  try {
    const config = getConfig();
    await railwayQuery(`
      mutation($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }
    `, {
      input: {
        projectId: config.projectId,
        serviceId,
        environmentId: config.environmentId,
        variables,
      },
    });
    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Delete a service from the project
 */
export async function deleteService(serviceId: string): Promise<RailwayResult<boolean>> {
  if (isMockMode()) return { success: true, mock: true, data: true };

  try {
    await railwayQuery(`
      mutation($id: String!) {
        serviceDelete(id: $id)
      }
    `, { id: serviceId });
    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Wait for a service deployment to reach a terminal status
 */
export async function waitForDeployment(
  serviceId: string,
  timeoutMs: number = 300000, // 5 minutes
  pollIntervalMs: number = 10000, // 10 seconds
): Promise<RailwayResult<{ status: string; domain?: string }>> {
  if (isMockMode()) return { success: true, mock: true, data: { status: 'SUCCESS', domain: 'mock.up.railway.app' } };

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await getServiceStatus(serviceId);
    if (!result.success) return { success: false, error: result.error };

    const status = result.data?.status;
    if (status === 'SUCCESS' || status === 'FAILED' || status === 'CRASHED') {
      return { success: status === 'SUCCESS', data: result.data };
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return { success: false, error: 'Deployment timed out' };
}

// --- Legacy Exports (backward compat) ---

export async function createProject(name: string): Promise<RailwayResult<{ id: string; name: string; url: string }>> {
  const config = getConfig();
  return { success: true, data: { id: config.projectId || 'shared', name, url: `https://railway.app/project/${config.projectId}` } };
}

export async function getDeploymentStatus(projectId: string): Promise<RailwayResult<{ status: string; url?: string }>> {
  const result = await listServices();
  if (!result.success) return { success: false, error: result.error };
  const first = result.data?.[0];
  return { success: true, data: { status: first?.status || 'UNKNOWN', url: first?.domain ? `https://${first.domain}` : undefined } };
}
