import fs from 'node:fs';
import path from 'node:path';

export interface AgentRosterEntry {
  id: string;
  name: string;
  emoji?: string;
  role: string;
  purpose?: string;
  sessionKey: string;
  heartbeatCron?: string;
}

export interface AgentRoster {
  gateway: { url: string; token: string };
  agents: AgentRosterEntry[];
}

function rosterPath() {
  // repo-root/agent-dashboard/agent-roster.json
  return path.join(process.cwd(), 'agent-roster.json');
}

export function loadRoster(): AgentRoster {
  const p = rosterPath();

  // Allow overriding gateway via env (recommended for Railway)
  const envUrl = process.env.HENRY_GATEWAY_URL || '';
  const envToken = process.env.HENRY_GATEWAY_TOKEN || '';

  let fileRoster: AgentRoster = { gateway: { url: '', token: '' }, agents: [] };
  if (fs.existsSync(p)) {
    fileRoster = JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  const merged: AgentRoster = {
    ...fileRoster,
    gateway: {
      url: envUrl || fileRoster.gateway?.url || '',
      token: envToken || fileRoster.gateway?.token || '',
    },
  };

  return merged;
}

export function getAgent(agentId: string): AgentRosterEntry | undefined {
  const roster = loadRoster();
  return roster.agents.find(a => a.id.toLowerCase() === agentId.toLowerCase());
}

export function listAgents(): AgentRosterEntry[] {
  return loadRoster().agents;
}
