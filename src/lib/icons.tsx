'use client';

import React from 'react';
import {
  MapTrifold,
  Sun,
  Crosshair,
  Star,
  MusicNotes,
  PawPrint,
  Rainbow,
  Crown,
  Rocket,
  Target,
  Robot,
  ArrowsClockwise,
  Flag,
  WarningCircle,
  Warning,
  Info,
  CheckCircle,
  User,
  Play,
  Pause,
  PencilSimple,
  Trash,
  ChartBar,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

// Agent ID to Phosphor icon mapping
export const AGENT_ICONS: Record<string, PhosphorIcon> = {
  atlas: MapTrifold,
  apollo: Sun,
  artemis: Crosshair,
  maia: Star,
  orpheus: MusicNotes,
  callisto: PawPrint,
  iris: Rainbow,
  andrew: Crown,
  cale: Rocket,
  henry: Target,
  arthur: Robot,
};

// Get icon component for an agent
export function getAgentIcon(agentId: string): PhosphorIcon {
  return AGENT_ICONS[agentId.toLowerCase()] || Robot;
}

// Render agent icon as JSX
interface AgentIconProps {
  agentId: string;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
}

export function AgentIcon({ agentId, size = 20, weight = 'fill', className = '' }: AgentIconProps) {
  const IconComponent = getAgentIcon(agentId);
  return <IconComponent size={size} weight={weight} className={className} />;
}

// Goal type icons
export const GOAL_TYPE_ICONS: Record<string, PhosphorIcon> = {
  'long-term': Target,
  'ongoing': ArrowsClockwise,
  'milestone': Flag,
};

export function getGoalTypeIcon(type: string): PhosphorIcon {
  return GOAL_TYPE_ICONS[type] || Target;
}

interface GoalTypeIconProps {
  type: string;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
}

export function GoalTypeIcon({ type, size = 16, weight = 'fill', className = '' }: GoalTypeIconProps) {
  const IconComponent = getGoalTypeIcon(type);
  return <IconComponent size={size} weight={weight} className={className} />;
}

// Priority icons with colors
export const PRIORITY_ICONS: Record<string, { icon: PhosphorIcon; color: string }> = {
  critical: { icon: WarningCircle, color: 'text-red-400' },
  high: { icon: Warning, color: 'text-orange-400' },
  medium: { icon: Info, color: 'text-yellow-400' },
  low: { icon: CheckCircle, color: 'text-green-400' },
};

export function getPriorityIcon(priority: string): { icon: PhosphorIcon; color: string } {
  return PRIORITY_ICONS[priority] || { icon: Info, color: 'text-zinc-400' };
}

interface PriorityIconProps {
  priority: string;
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  className?: string;
}

export function PriorityIcon({ priority, size = 14, weight = 'fill', className = '' }: PriorityIconProps) {
  const { icon: IconComponent, color } = getPriorityIcon(priority);
  return <IconComponent size={size} weight={weight} className={`${color} ${className}`} />;
}

// Action icons
export const ActionIcons = {
  play: Play,
  pause: Pause,
  edit: PencilSimple,
  delete: Trash,
  metrics: ChartBar,
  user: User,
};

// Agent avatar component with icon
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
};

const AGENT_COLORS: Record<string, string> = {
  atlas: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  apollo: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  artemis: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
  maia: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
  orpheus: 'bg-pink-600/20 text-pink-400 border-pink-500/30',
  callisto: 'bg-orange-600/20 text-orange-400 border-orange-500/30',
  iris: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
  andrew: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  cale: 'bg-red-600/20 text-red-400 border-red-500/30',
  henry: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30',
  arthur: 'bg-zinc-600/20 text-zinc-400 border-zinc-500/30',
};

export function AgentAvatar({ agentId, size = 'md', className = '', showStatus = false, status }: AgentAvatarProps) {
  const sizeConfig = AVATAR_SIZES[size];
  const colorClass = AGENT_COLORS[agentId.toLowerCase()] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
  
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeConfig.container} rounded-lg flex items-center justify-center border ${colorClass}`}>
        <AgentIcon agentId={agentId} size={sizeConfig.icon} weight="fill" />
      </div>
      {showStatus && status && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 ${sizeConfig.status} rounded-full border-2 border-[#0e0e15]
            ${status === 'online' ? 'bg-green-500' : ''}
            ${status === 'offline' ? 'bg-zinc-500' : ''}
            ${status === 'busy' ? 'bg-amber-500' : ''}
          `}
        />
      )}
    </div>
  );
}
