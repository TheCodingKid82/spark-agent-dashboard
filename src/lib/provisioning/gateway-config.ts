/**
 * Gateway Configuration Manager
 * 
 * Handles post-deploy configuration of Clawdbot agents:
 * - Setup wizard automation (/setup endpoint)
 * - File pushing via /tools/invoke (write tool)
 * - Agent messaging and health checks
 */

interface SetupOptions {
  gatewayUrl: string;
  setupPassword: string;
  anthropicApiKey: string;
  model?: string;
  telegramBotToken?: string;
}

/**
 * Run the Clawdbot setup wizard programmatically
 * This configures the model, API key, and channels on a fresh agent
 */
export async function runSetupWizard(options: SetupOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // The setup wizard expects a POST to /setup with config
    const setupConfig: Record<string, unknown> = {
      password: options.setupPassword,
      provider: 'anthropic',
      apiKey: options.anthropicApiKey,
      model: options.model || 'anthropic/claude-sonnet-4-20250514',
    };

    if (options.telegramBotToken) {
      setupConfig.telegram = {
        botToken: options.telegramBotToken,
      };
    }

    const response = await fetch(`${options.gatewayUrl}/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setupConfig),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Setup failed (${response.status}): ${text}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Push workspace files to a running Clawdbot agent via /tools/invoke (write tool)
 */
export async function pushWorkspaceFiles(
  gatewayUrl: string,
  gatewayToken: string,
  files: Record<string, string>,
): Promise<{ success: boolean; pushed: string[]; errors: string[] }> {
  const pushed: string[] = [];
  const errors: string[] = [];

  for (const [filename, content] of Object.entries(files)) {
    try {
      const response = await fetch(`${gatewayUrl}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({
          tool: 'write',
          args: {
            path: filename,
            content: content,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        pushed.push(filename);
      } else {
        const text = await response.text();
        errors.push(`${filename}: HTTP ${response.status} — ${text}`);
      }
    } catch (error) {
      errors.push(`${filename}: ${String(error)}`);
    }
  }

  return { success: errors.length === 0, pushed, errors };
}

/**
 * Send a message to an agent via /tools/invoke (sessions_send)
 */
export async function sendAgentMessage(
  gatewayUrl: string,
  gatewayToken: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_send',
        args: {
          message,
          sessionKey: 'main',
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Message send failed (${response.status}): ${text}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Health check an agent's gateway
 */
export async function checkAgentHealth(
  gatewayUrl: string,
  gatewayToken: string,
): Promise<{ healthy: boolean; status?: string; error?: string }> {
  try {
    const response = await fetch(`${gatewayUrl}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return { healthy: true, status: 'running' };
    }

    return { healthy: false, status: 'unhealthy', error: `HTTP ${response.status}` };
  } catch (error) {
    return { healthy: false, error: String(error) };
  }
}

/**
 * Push gateway config patch via /tools/invoke (gateway tool)
 */
export async function pushGatewayConfig(
  gatewayUrl: string,
  gatewayToken: string,
  configPatch: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${gatewayUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'gateway',
        args: {
          action: 'config.patch',
          raw: JSON.stringify(configPatch),
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Config push failed (${response.status}): ${text}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
