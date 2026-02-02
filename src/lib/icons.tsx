'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Map,
  Sun,
  Crosshair,
  Star,
  Music,
  PawPrint,
  Sparkles,
  Crown,
  Rocket,
  Target,
  Bot,
  RefreshCw,
  Flag,
  TriangleAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  User,
  Play,
  Pause,
  Pencil,
  Trash2,
  BarChart3,
} from 'lucide-react';

// Agent ID → icon mapping (Lucide)
export const AGENT_ICONS: Record<string, LucideIcon> = {
  atlas: Map,
  apollo: Sun,
  artemis: Crosshair,
  maia: Star,
  orpheus: Music,
  callisto: PawPrint,
  iris: Sparkles,
  andrew: Crown,
  cale: Rocket,
  henry: Target,
  arthur: Bot,
};

export function getAgentIcon(agentId: string): LucideIcon {
  return AGENT_ICONS[agentId?.toLowerCase() || ''] || Bot;
}

interface AgentIconProps {
  agentId: string;
  size?: number;
  className?: string;
}

export function AgentIcon({ agentId, size = 20, className = '' }: AgentIconProps) {
  const IconComponent = getAgentIcon(agentId);
  return <IconComponent width={size} height={size} className={className} />;
}

// Goal type icons
export const GOAL_TYPE_ICONS: Record<string, LucideIcon> = {
  'long-term': Target,
  ongoing: RefreshCw,
  milestone: Flag,
};

export function getGoalTypeIcon(type: string): LucideIcon {
  return GOAL_TYPE_ICONS[type] || Target;
}

interface GoalTypeIconProps {
  type: string;
  size?: number;
  className?: string;
}

export function GoalTypeIcon({ type, size = 16, className = '' }: GoalTypeIconProps) {
  const IconComponent = getGoalTypeIcon(type);
  return <IconComponent width={size} height={size} className={className} />;
}

// Priority icons with colors
export const PRIORITY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  critical: { icon: TriangleAlert, color: 'text-red-400' },
  high: { icon: AlertTriangle, color: 'text-orange-400' },
  medium: { icon: Info, color: 'text-yellow-400' },
  low: { icon: CheckCircle2, color: 'text-green-400' },
};

export function getPriorityIcon(priority: string): { icon: LucideIcon; color: string } {
  return PRIORITY_ICONS[priority] || { icon: Info, color: 'text-zinc-400' };
}

interface PriorityIconProps {
  priority: string;
  size?: number;
  className?: string;
}

export function PriorityIcon({ priority, size = 14, className = '' }: PriorityIconProps) {
  const { icon: IconComponent, color } = getPriorityIcon(priority);
  return <IconComponent width={size} height={size} className={`${color} ${className}`} />;
}

// Action icons
export const ActionIcons = {
  play: Play,
  pause: Pause,
  edit: Pencil,
  delete: Trash2,
  metrics: BarChart3,
  user: User,
};

// Agent avatar component
interface AgentAvatarProps {
  agentId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'busy';
}

const AVATAR_SIZES = {
  sm: { container: 'w-6 h-6', icon: 14, status: 'w-2 h-2' },
  md: { container: 'w-8 h-8', icon: 18, status: 'w-3 h-3' },
  lg: { container: 'w-12 h-12', icon: 24, status: 'w-4 h-4' },
} as const;

const AGENT_COLORS: Record<string, string> = {
  atlas: 'bg-blue-600/20 text-blue-300 border-blue-500/30',
  apollo: 'bg-amber-600/20 text-amber-300 border-amber-500/30',
  artemis: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
  maia: 'bg-purple-600/20 text-purple-300 border-purple-500/30',
  orpheus: 'bg-pink-600/20 text-pink-300 border-pink-500/30',
  callisto: 'bg-orange-600/20 text-orange-300 border-orange-500/30',
  iris: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30',
  andrew: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
  cale: 'bg-red-600/20 text-red-300 border-red-500/30',
  henry: 'bg-cyan-600/20 text-cyan-300 border-cyan-500/30',
  arthur: 'bg-zinc-600/20 text-zinc-300 border-zinc-500/30',
};

export function AgentAvatar({
  agentId,
  size = 'md',
  className = '',
  showStatus = false,
  status,
}: AgentAvatarProps) {
  const sizeConfig = AVATAR_SIZES[size];
  const colorClass = AGENT_COLORS[agentId?.toLowerCase() || ''] || 'bg-zinc-800 text-zinc-300 border-zinc-700';

  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeConfig.container} rounded-lg flex items-center justify-center border ${colorClass}`}>
        <AgentIcon agentId={agentId} size={sizeConfig.icon} className="opacity-90" />
      </div>
      {showStatus && status && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${sizeConfig.status} rounded-full border-2 border-[#0a0a0f]
            ${status === 'online' ? 'bg-green-500' : ''}
            ${status === 'offline' ? 'bg-zinc-500' : ''}
            ${status === 'busy' ? 'bg-amber-500' : ''}
          `}
        />
      )}
    </div>
  );
}
