/**
 * Telegram Bot Provisioning
 * 
 * Note: BotFather doesn't have an API — bots are created manually via @BotFather.
 * This module provides helpers for when a bot token is manually provided,
 * and generates instructions for creating new bots.
 * 
 * Future: Could automate via a user-bot session (MTProto) but that's complex.
 * For now, we document the manual step and handle everything else automatically.
 */

interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

/**
 * Validate a Telegram bot token by calling getMe
 */
export async function validateBotToken(token: string): Promise<{
  valid: boolean;
  bot?: TelegramBotInfo;
  error?: string;
}> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.ok && data.result) {
      return { valid: true, bot: data.result };
    }

    return { valid: false, error: data.description || 'Invalid token' };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

/**
 * Generate BotFather instructions for creating a new bot
 */
export function generateBotCreationInstructions(agentName: string): string {
  const botUsername = agentName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return `
## Create Telegram Bot for ${agentName}

1. Open Telegram and message @BotFather
2. Send: /newbot
3. Name: ${agentName}
4. Username: ${botUsername}_bot (must end in 'bot')
5. Copy the bot token (looks like: 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw)
6. Paste it into the Agent Dashboard when prompted

Alternatively, if you already have a bot token, enter it directly.
  `.trim();
}

/**
 * Set webhook for a Telegram bot (useful for gateway integration)
 */
export async function setWebhook(
  token: string,
  webhookUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`,
      { signal: AbortSignal.timeout(10000) },
    );

    const data = await response.json();
    return {
      success: data.ok === true,
      error: data.ok ? undefined : (data.description || 'Failed to set webhook'),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Delete webhook for a Telegram bot
 */
export async function deleteWebhook(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/deleteWebhook`,
      { signal: AbortSignal.timeout(10000) },
    );

    const data = await response.json();
    return {
      success: data.ok === true,
      error: data.ok ? undefined : data.description,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
