/**
 * Provisioning Status Store
 * 
 * Tracks provisioning state for each agent.
 * Persists to src/data/provisioning.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const STORE_PATH = join(process.cwd(), 'src', 'data', 'provisioning.json');

export interface ProvisioningRecord {
  agentId: string;
  agentName: string;
  agentRole?: string;
  agentPurpose?: string;
  roleTemplate?: string;
  railwayProjectId?: string;
  railwayServiceId?: string;
  railwayDeploymentStatus?: string;
  railwayUrl?: string;
  domain?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  email?: string;
  emailPassword?: string;
  emailStatus?: string;
  whopUsername?: string;
  whopPassword?: string;
  whopStatus?: string;
  telegramBotToken?: string;
  telegramBotUsername?: string;
  provisionedAt?: string;
  lastHealthCheck?: string;
  healthStatus?: string;
  workspaceFilesGenerated?: boolean;
  agentDirectoryUpdated?: boolean;
  status: 'pending' | 'provisioning' | 'complete' | 'partial' | 'error';
  isMock?: boolean;
  error?: string;
}

interface ProvisioningStore {
  records: ProvisioningRecord[];
  lastUpdated: string;
}

function readStore(): ProvisioningStore {
  try {
    if (existsSync(STORE_PATH)) {
      const raw = readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // If file is corrupted, start fresh
  }
  return { records: [], lastUpdated: new Date().toISOString() };
}

function writeStore(store: ProvisioningStore): void {
  store.lastUpdated = new Date().toISOString();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Get all provisioning records
 */
export function getAllRecords(): ProvisioningRecord[] {
  return readStore().records;
}

/**
 * Get provisioning record for a specific agent
 */
export function getRecord(agentId: string): ProvisioningRecord | null {
  const store = readStore();
  return store.records.find((r) => r.agentId === agentId) || null;
}

/**
 * Create or update a provisioning record
 */
export function upsertRecord(record: ProvisioningRecord): void {
  const store = readStore();
  const existingIndex = store.records.findIndex((r) => r.agentId === record.agentId);
  if (existingIndex >= 0) {
    store.records[existingIndex] = { ...store.records[existingIndex], ...record };
  } else {
    store.records.push(record);
  }
  writeStore(store);
}

/**
 * Update specific fields of a provisioning record
 */
export function updateRecord(agentId: string, updates: Partial<ProvisioningRecord>): ProvisioningRecord | null {
  const store = readStore();
  const record = store.records.find((r) => r.agentId === agentId);
  if (!record) return null;

  Object.assign(record, updates);
  writeStore(store);
  return record;
}

/**
 * Delete a provisioning record
 */
export function deleteRecord(agentId: string): boolean {
  const store = readStore();
  const before = store.records.length;
  store.records = store.records.filter((r) => r.agentId !== agentId);
  if (store.records.length < before) {
    writeStore(store);
    return true;
  }
  return false;
}
