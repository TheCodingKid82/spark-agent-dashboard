export interface GatewayClientConfig {
  url: string; // e.g. https://<host>
  token: string;
}

export async function gatewayToolsInvoke<T = unknown>(
  cfg: GatewayClientConfig,
  tool: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${cfg.url.replace(/\/$/, '')}/tools/invoke`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify({ tool, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway /tools/invoke failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}
