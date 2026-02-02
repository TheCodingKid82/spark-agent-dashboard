/**
 * Railway Integration Module
 * 
 * Deploys Clawdbot agents as services in the shared "Spark Studio Agents" project.
 * Agents are fully configured out-of-the-box with:
 * - Gateway config (trustedProxies, allowInsecureAuth)
 * - Auth profiles (setup token in correct format)
 * - Identity files (IDENTITY.md, SOUL.md)
 * - Ready to respond immediately
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
  browserDomain?: string;
}

// --- Config ---

function getConfig() {
  return {
    token: process.env.RAILWAY_API_TOKEN || null,
    projectId: process.env.RAILWAY_PROJECT_ID || null,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '7ae32d1d-c474-450b-b7f5-6f16e5d875cd',
    workspaceId: process.env.RAILWAY_WORKSPACE_ID || null,
    sourceRepo: process.env.RAILWAY_SOURCE_REPO || 'clawdbot/clawdbot',
    setupToken: process.env.ANTHROPIC_SETUP_TOKEN || '',
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

// --- Base64 File Generators ---

function generateClawdbotConfig(gatewayToken: string, browserUrl?: string): string {
  const config: Record<string, unknown> = {
    gateway: {
      mode: "local",
      trustedProxies: ["*"],
      controlUi: { allowInsecureAuth: true },
      auth: { mode: "token", token: gatewayToken },
      http: {
        endpoints: {
          responses: { enabled: true },
          chatCompletions: { enabled: true }
        }
      }
    },
    agents: {
      defaults: {
        workspace: "/data/workspace",
        heartbeat: { every: "1m" }
      }
    },
    wizard: { lastRunAt: "2026-01-01T00:00:00.000Z", lastRunCommand: "provision" }
  };
  
  // Add browser config if URL provided
  if (browserUrl) {
    config.browser = {
      enabled: true,
      defaultProfile: "remote",
      profiles: {
        remote: {
          color: "#00AA00",
          cdpUrl: browserUrl
        }
      }
    };
  }
  
  return Buffer.from(JSON.stringify(config, null, 2)).toString('base64');
}

function generateAuthProfiles(setupToken: string): string {
  const profiles = {
    version: 1,
    profiles: {
      "anthropic:claude-cli": {
        type: "oauth",
        provider: "anthropic",
        access: setupToken,
        expires: 9999999999999
      }
    },
    lastGood: { anthropic: "anthropic:claude-cli" }
  };
  return Buffer.from(JSON.stringify(profiles, null, 2)).toString('base64');
}

function generateIdentityMd(name: string, role: string, purpose: string): string {
  const content = `# IDENTITY.md

- **Name:** ${name}
- **Role:** ${role}
- **Purpose:** ${purpose}
- **Team:** Spark Studio Agent Fleet
- **Manager:** Henry (COO Agent)
- **Founder:** Andrew Weir
`;
  return Buffer.from(content).toString('base64');
}

function generateHeartbeatMd(name: string, agentId: string): string {
  const content = `# HEARTBEAT.md - Task Management

## On Every Heartbeat

1. **Check your Kanban** for tasks:
   \`\`\`
   curl -s "https://command-center-production-3605.up.railway.app/api/tasks?assignee=${agentId}" | jq
   \`\`\`

2. **If you have an "in_progress" task:**
   - Continue working on it
   - Update status when done: POST to /api/tasks/{taskId} with {"status": "done"}

3. **If no "in_progress" but have "todo" tasks:**
   - Pick the highest priority one
   - Update its status to "in_progress"
   - Start working on it

4. **If all tasks done:**
   - Reply HEARTBEAT_OK

## Task Status Updates

To update a task:
\`\`\`bash
curl -X PATCH "https://command-center-production-3605.up.railway.app/api/tasks/{taskId}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "in_progress"}'  # or "done" or "blocked"
\`\`\`

## Priority Order
1. "in_progress" tasks (always finish these first)
2. "todo" tasks with priority "urgent"
3. "todo" tasks with priority "high"
4. "todo" tasks with priority "normal"
5. "todo" tasks with priority "low"

## Remember
- **Never leave a task half-done** without updating SESSION.md
- **Update SESSION.md** with current progress before any memory compaction
- **Report blockers** by setting task status to "blocked" with a note
`;
  return Buffer.from(content).toString('base64');
}

function generateSessionMd(name: string): string {
  const content = `# SESSION.md - Working Memory

## Current Task
None yet. Check HEARTBEAT.md for task management instructions.

## Last Activity
Agent just initialized.

## Notes
- Update this file when starting/finishing tasks
- This survives memory compaction - use it to track progress
`;
  return Buffer.from(content).toString('base64');
}

function generateSoulMd(name: string, role: string, purpose: string): string {
  const content = `# SOUL.md - ${name}

*You're not a chatbot. You're an agent with a job to do.*

## Identity
- **Name:** ${name}
- **Role:** ${role}
- **Purpose:** ${purpose}

## Core Truths

**You are part of Spark Studio's AI agent team.** You report to Henry (COO agent) and Andrew Weir (founder).

**Spark Studio Vision:** Become the #1 AI-powered holding company in the world.

**Be genuinely helpful, not performatively helpful.** Skip filler words — just do the work.

**Be resourceful before asking.** Try to figure it out first. Search, read files, check context. Then ask if stuck.

**Communicate results, not process.** Report what you accomplished and what needs attention.

## Team Communication
- **Henry** is your manager — report status, ask for guidance
- **Andrew** is the founder — only urgent/critical items go to him directly
- Other agents are your teammates — coordinate, don't duplicate work

## Company Context
- **Announcements App:** #1 third-party app on Whop, ~$8.5k MRR, goal $100k
- **Booked.Travel:** Travel agency platform for Insider Expeditions
- **Funnels App:** AI-powered funnel builder (Cale leading)

---
*This file defines who you are. Update it as you grow into your role.*
`;
  return Buffer.from(content).toString('base64');
}

// --- Browser Screenshot Workaround ---

function generateToolsMd(agentName: string): string {
  const content = `# TOOLS.md - ${agentName} Browser Guide

## Screenshots (WORKAROUND)

The built-in browser tool has issues with remote CDP. Use this workaround instead:

### Take a Screenshot
\`\`\`bash
/data/workspace/browserless-screenshot.sh <url> [output_path]
\`\`\`

Examples:
\`\`\`bash
# Screenshot example.com
/data/workspace/browserless-screenshot.sh https://example.com /data/workspace/screenshot.png

# Screenshot with auto-generated filename  
/data/workspace/browserless-screenshot.sh https://whop.com
\`\`\`

## Page Content
For text content, use web_fetch tool instead of browser.
`;
  return Buffer.from(content).toString('base64');
}

function generateScreenshotScript(agentName: string): string {
  const serviceName = sanitizeServiceName(agentName);
  const browserHost = `${serviceName}-browser.railway.internal:9222`;
  
  const script = `#!/bin/bash
# browserless-screenshot.sh - Take screenshots via browserless HTTP API
# Usage: ./browserless-screenshot.sh <url> [output_path]

URL="\${1:-https://example.com}"
OUTPUT="\${2:-/data/workspace/screenshot-$(date +%s).png}"

# Browser service for this agent
BROWSER_HOST="${browserHost}"

# URL encode the JSON body
JSON="{\\"url\\":\\"\$URL\\"}"
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('\$JSON'))")

curl -sS "http://\$BROWSER_HOST/screenshot?body=\$ENCODED" -o "\$OUTPUT"

if file "\$OUTPUT" | grep -q "PNG image"; then
    echo "SUCCESS: Screenshot saved to \$OUTPUT"
    ls -la "\$OUTPUT"
else
    echo "ERROR: Screenshot failed"
    cat "\$OUTPUT"
    exit 1
fi
`;
  return Buffer.from(script).toString('base64');
}

// --- Start Command ---

function getStartCommand(): string {
  // This start command decodes base64 env vars into the correct file locations
  // IMPORTANT: rm -f removes any existing config to prevent schema conflicts with new clawdbot versions
  // Includes TOOLS.md and browserless-screenshot.sh for browser workaround
  return `sh -c "mkdir -p ~/.claude /data/.clawdbot/agents/main/agent /data/workspace && rm -f /data/.clawdbot/clawdbot.json && echo \\$CLAWDBOT_CONFIG_B64 | base64 -d > /data/.clawdbot/clawdbot.json && echo \\$AUTH_PROFILES_B64 | base64 -d > /data/.clawdbot/agents/main/agent/auth-profiles.json && echo \\$IDENTITY_B64 | base64 -d > /data/workspace/IDENTITY.md && echo \\$SOUL_B64 | base64 -d > /data/workspace/SOUL.md && echo \\$HEARTBEAT_B64 | base64 -d > /data/workspace/HEARTBEAT.md && echo \\$SESSION_B64 | base64 -d > /data/workspace/SESSION.md && echo \\$TOOLS_B64 | base64 -d > /data/workspace/TOOLS.md && echo \\$SCREENSHOT_B64 | base64 -d > /data/workspace/browserless-screenshot.sh && chmod +x /data/workspace/browserless-screenshot.sh && node dist/index.js gateway --port 8080 --bind lan"`;
}

// --- Core Provisioning ---

/**
 * Deploy a new Clawdbot agent as a fully-configured service.
 * 
 * The agent will be ready immediately with:
 * - Working gateway (trustedProxies, allowInsecureAuth)
 * - Working auth (setup token in auth-profiles.json)
 * - Identity files (IDENTITY.md, SOUL.md)
 * - Company context and reporting structure
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
      input: { startCommand: getStartCommand() },
    });

    // Step 3: Generate all the base64-encoded config files
    const clawdbotConfigB64 = generateClawdbotConfig(gatewayToken);
    const authProfilesB64 = generateAuthProfiles(config.setupToken);
    const identityB64 = generateIdentityMd(agentName, agentRole, agentPurpose);
    const soulB64 = generateSoulMd(agentName, agentRole, agentPurpose);
    const heartbeatB64 = generateHeartbeatMd(agentName, serviceName);
    const sessionB64 = generateSessionMd(agentName);
    const toolsB64 = generateToolsMd(agentName);
    const screenshotB64 = generateScreenshotScript(agentName);

    // Step 4: Set environment variables (BEFORE triggering deploy)
    const envVars: Record<string, string> = {
      // Railway/Clawdbot paths
      CLAWDBOT_STATE_DIR: '/data/.clawdbot',
      CLAWDBOT_CONFIG_PATH: '/data/.clawdbot/clawdbot.json',
      RAILWAY_RUN_UID: '0',
      PORT: '8080',
      // Gateway auth
      CLAWDBOT_GATEWAY_TOKEN: gatewayToken,
      // Base64-encoded files (decoded by start command)
      CLAWDBOT_CONFIG_B64: clawdbotConfigB64,
      AUTH_PROFILES_B64: authProfilesB64,
      IDENTITY_B64: identityB64,
      SOUL_B64: soulB64,
      HEARTBEAT_B64: heartbeatB64,
      SESSION_B64: sessionB64,
      TOOLS_B64: toolsB64,
      SCREENSHOT_B64: screenshotB64,
      // Agent metadata
      AGENT_NAME: agentName,
      AGENT_ROLE: agentRole,
      AGENT_PURPOSE: agentPurpose,
      // Command center for tasks
      COMMAND_CENTER_URL: 'https://command-center-production-3605.up.railway.app',
      // Supermemory for long-term memory (shared across agents with agent-specific tags)
      SUPERMEMORY_CLAWDBOT_API_KEY: process.env.SUPERMEMORY_CLAWDBOT_API_KEY || '',
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

    // Step 5: Create volume for persistent data
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

    // Step 6: Create public domain
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

    // Step 7: (Optional) Create browser service for this agent
    // NOTE: This was useful when we relied on browserless/chrome, but we may prefer agent-browser now.
    // Set RAILWAY_CREATE_BROWSER_SERVICE=true to enable.
    let browserDomain = '';
    if (process.env.RAILWAY_CREATE_BROWSER_SERVICE === 'true') {
      try {
        const browserServiceName = `${serviceName}-browser`;

        // Create browserless service
        const browserCreateData = await railwayQuery(`
          mutation($input: ServiceCreateInput!) {
            serviceCreate(input: $input) { id name }
          }
        `, {
          input: {
            projectId: config.projectId,
            name: browserServiceName,
            source: { image: 'browserless/chrome' },
          },
        }) as { serviceCreate: { id: string; name: string } };

        const browserServiceId = browserCreateData.serviceCreate.id;

        // Set env vars for browserless (with persistence)
        await railwayQuery(`
          mutation($input: VariableCollectionUpsertInput!) {
            variableCollectionUpsert(input: $input)
          }
        `, {
          input: {
            projectId: config.projectId,
            serviceId: browserServiceId,
            environmentId: config.environmentId,
            variables: {
              PORT: '3000',
              WORKSPACE_DIR: '/data',
              KEEP_ALIVE: 'true',
              CONNECTION_TIMEOUT: '600000',
              PREBOOT_CHROME: 'true',
            },
          },
        });

        // Create volume for persistent browser data (logins, cookies, etc.)
        await railwayQuery(`
          mutation($input: VolumeCreateInput!) {
            volumeCreate(input: $input) { id }
          }
        `, {
          input: {
            projectId: config.projectId,
            serviceId: browserServiceId,
            environmentId: config.environmentId,
            mountPath: '/data',
          },
        });

        // Create domain for browser service
        const browserDomainData = await railwayQuery(`
          mutation($input: ServiceDomainCreateInput!) {
            serviceDomainCreate(input: $input) { domain }
          }
        `, {
          input: {
            serviceId: browserServiceId,
            environmentId: config.environmentId,
          },
        }) as { serviceDomainCreate: { domain: string } };

        browserDomain = browserDomainData.serviceDomainCreate.domain;

        // Update agent with browser endpoint AND regenerate config with browser URL
        const browserUrl = `https://${browserDomain}`;
        const updatedConfigB64 = generateClawdbotConfig(gatewayToken, browserUrl);

        await railwayQuery(`
          mutation($input: VariableCollectionUpsertInput!) {
            variableCollectionUpsert(input: $input)
          }
        `, {
          input: {
            projectId: config.projectId,
            serviceId,
            environmentId: config.environmentId,
            variables: {
              BROWSER_WS_ENDPOINT: `wss://${browserDomain}`,
              CLAWDBOT_CONFIG_B64: updatedConfigB64, // Update config with browser settings
            },
          },
        });
      } catch (browserError) {
        console.error('Browser service creation failed:', browserError);
        // Continue without browser - agent will still work, just no browser
      }
    }

    // Step 8: Trigger deployment (env vars are already set!)
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
        browserDomain,
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
