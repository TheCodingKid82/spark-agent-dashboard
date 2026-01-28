export type AgentStatus = "online" | "offline" | "busy";

export interface ActivityEntry {
  timestamp: string;
  action: string;
}

export interface CommunicationEntry {
  from: string;
  to: string;
  message: string;
  timestamp: string;
}

export interface AgentMetrics {
  tasksCompleted: number;
  uptime: string;
  lastActive: string;
}

export interface AgentInfrastructure {
  railwayProjectId?: string;
  railwayServiceId?: string;
  railwayStatus?: 'pending' | 'deploying' | 'running' | 'stopped' | 'error' | string;
  railwayUrl?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  email?: string;
  whopUsername?: string;
  provisionedAt?: string;
  lastHealthCheck?: string;
}

export type ProvisioningStepStatus = 'pending' | 'in-progress' | 'complete' | 'error';

export interface ProvisioningStep {
  id: string;
  label: string;
  status: ProvisioningStepStatus;
  message?: string;
}

export interface ProvisioningState {
  agentId: string;
  steps: ProvisioningStep[];
  overallStatus: 'idle' | 'provisioning' | 'complete' | 'error';
  startedAt?: string;
  completedAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  status: AgentStatus;
  purpose: string;
  specialties: string[];
  parentId: string | null;
  recentActivity: ActivityEntry[];
  communications: CommunicationEntry[];
  metrics: AgentMetrics;
  infrastructure?: AgentInfrastructure;
}

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string;
}

export interface AgentData {
  agents: Agent[];
  edges: AgentEdge[];
}
