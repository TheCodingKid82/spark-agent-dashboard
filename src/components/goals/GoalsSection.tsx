'use client';

import { useState, useEffect } from 'react';
import { Target, ChevronDown, ChevronRight } from 'lucide-react';
import { ChartBar } from '@phosphor-icons/react';
import { GoalTypeIcon, PriorityIcon } from '@/lib/icons';

interface Goal {
  id: string;
  agentId: string;
  title: string;
  description: string;
  type: 'long-term' | 'ongoing' | 'milestone';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed';
  metrics?: string;
}

const PRIORITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

// Type icons now imported from @/lib/icons

interface GoalsSectionProps {
  agentId: string;
  agentName: string;
}

export default function GoalsSection({ agentId, agentName }: GoalsSectionProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, [agentId]);

  const fetchGoals = async () => {
    try {
      // Fetch goals for this agent AND goals for "all" agents
      const res = await fetch(`/api/goals?agentId=${agentId}&status=active`);
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2"
      >
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          Goals ({goals.length})
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>

      {expanded && (
        <>
          {loading ? (
            <div className="text-[10px] text-zinc-600 py-2">Loading...</div>
          ) : goals.length === 0 ? (
            <div className="text-[10px] text-zinc-600 py-2 italic">
              No goals set for {agentName}
            </div>
          ) : (
            <div className="space-y-2">
              {goals.map(goal => (
                <div
                  key={goal.id}
                  className="p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30"
                >
                  <div className="flex items-start gap-2">
                    <GoalTypeIcon type={goal.type} size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h4 className="text-[11px] font-medium text-zinc-200 truncate">
                          {goal.title}
                        </h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${PRIORITY_COLORS[goal.priority]}`}>
                          <PriorityIcon priority={goal.priority} size={10} />
                          {goal.priority}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 line-clamp-2">
                        {goal.description}
                      </p>
                      {goal.metrics && (
                        <p className="text-[9px] text-indigo-400 mt-1 flex items-center gap-1">
                          <ChartBar size={10} weight="fill" />
                          {goal.metrics}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
