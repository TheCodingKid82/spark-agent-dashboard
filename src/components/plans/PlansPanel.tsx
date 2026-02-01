'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Users,
  Calendar,
  CaretDown,
  CaretRight,
  Plus,
  ArrowsClockwise,
  WarningCircle,
} from '@phosphor-icons/react';
import { AgentIcon } from '@/lib/icons';

interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
}

interface PlanUpdate {
  id: string;
  timestamp: string;
  message: string;
  type: 'progress' | 'blocker' | 'completed' | 'note';
}

interface Plan {
  id: string;
  agentId: string;
  agentName: string;
  objective: string;
  description?: string;
  steps: PlanStep[];
  collaborators: string[];
  cronSchedule?: string;
  estimatedHours?: number;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  updates: PlanUpdate[];
  submittedAt: string;
  approvedAt?: string;
  completedAt?: string;
  rejectionReason?: string;
}

interface AgentActivity {
  agentId: string;
  lastDmActivity?: string;
  status: 'working' | 'idle' | 'offline';
  currentTask?: string;
}

const STATUS_CONFIG = {
  pending: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Pending Approval' },
  approved: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Approved' },
  in_progress: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'In Progress' },
  completed: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Completed' },
  rejected: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Rejected' },
};

const ACTIVITY_CONFIG = {
  working: { color: 'text-green-400', bg: 'bg-green-500', label: 'Working' },
  idle: { color: 'text-yellow-400', bg: 'bg-yellow-500', label: 'Idle' },
  offline: { color: 'text-zinc-500', bg: 'bg-zinc-500', label: 'Offline' },
};

// Head agents who can submit plans
const HEAD_AGENTS = [
  { id: 'atlas', name: 'Atlas', role: 'Head of Announcements' },
  { id: 'apollo', name: 'Apollo', role: 'Head of Agency' },
  { id: 'artemis', name: 'Artemis', role: 'Head of Funnels' },
];

export function PlansPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [requestPrompt, setRequestPrompt] = useState('');
  const [requesting, setRequesting] = useState(false);

  const fetchData = async () => {
    try {
      const [plansRes, activityRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/activity'),
      ]);
      
      const plansData = await plansRes.json();
      const activityData = await activityRes.json();
      
      if (plansData.success) setPlans(plansData.plans);
      if (activityData.success) setActivities(activityData.activities || []);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (planId: string, action: string, data?: object) => {
    try {
      const res = await fetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, action, ...data }),
      });
      
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  const handleRequestPlan = async () => {
    if (!selectedAgent) return;
    
    setRequesting(true);
    try {
      const agent = HEAD_AGENTS.find(a => a.id === selectedAgent);
      const message = requestPrompt.trim() 
        ? `Create a detailed plan for: ${requestPrompt}\n\nSubmit your plan using POST /api/plans with: objective, description, steps (array with id, description, status), collaborators (agent IDs), cronSchedule (optional), estimatedHours. Include specific metrics and success criteria.`
        : `Review your current goals and create a detailed action plan. Submit using POST /api/plans with: objective, description, steps (array), collaborators, cronSchedule, estimatedHours. Be specific about metrics and timelines.`;
      
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent,
          message,
          fromId: 'andrew',
        }),
      });
      
      if (res.ok) {
        setShowRequestModal(false);
        setSelectedAgent('');
        setRequestPrompt('');
        // Show success feedback
        alert(`Plan request sent to ${agent?.name}. They will submit their plan shortly.`);
      }
    } catch (error) {
      console.error('Request failed:', error);
    } finally {
      setRequesting(false);
    }
  };

  const filteredPlans = filter === 'all' 
    ? plans 
    : plans.filter(p => p.status === filter);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800/50">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Agent Plans
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Request Plan
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <ArrowsClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Filter tabs */}
        <div className="flex gap-1 text-xs">
          {['all', 'pending', 'in_progress', 'completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filter === f 
                  ? 'bg-indigo-500/20 text-indigo-400' 
                  : 'hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ')}
              {f !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({plans.filter(p => p.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Activity Summary */}
      <div className="p-3 border-b border-zinc-800/50 bg-zinc-900/30">
        <p className="text-xs text-zinc-500 mb-2">Agent Status</p>
        <div className="flex flex-wrap gap-2">
          {activities.map(a => (
            <div
              key={a.agentId}
              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-800/50"
            >
              <div className={`w-2 h-2 rounded-full ${ACTIVITY_CONFIG[a.status].bg}`} />
              <AgentIcon agentId={a.agentId} size={16} />
              <span className="text-xs capitalize">{a.agentId}</span>
              {a.lastDmActivity && (
                <span className="text-xs text-zinc-500">
                  {formatTime(a.lastDmActivity)}
                </span>
              )}
            </div>
          ))}
          {activities.length === 0 && (
            <span className="text-xs text-zinc-500">No activity data</span>
          )}
        </div>
      </div>

      {/* Plans List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <ArrowsClockwise className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No plans yet</p>
            <p className="text-xs mt-1">Agents will submit plans here</p>
          </div>
        ) : (
          filteredPlans.map(plan => {
            const config = STATUS_CONFIG[plan.status];
            const isExpanded = expandedPlan === plan.id;
            const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
            
            return (
              <div
                key={plan.id}
                className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}
              >
                {/* Plan Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                >
                  <div className="flex items-start gap-3">
                    <AgentIcon agentId={plan.agentId} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{plan.agentName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 line-clamp-2">{plan.objective}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                        {plan.estimatedHours && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {plan.estimatedHours}h
                          </span>
                        )}
                        {plan.collaborators.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {plan.collaborators.length}
                          </span>
                        )}
                        {plan.cronSchedule && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {plan.cronSchedule}
                          </span>
                        )}
                        <span>{formatTime(plan.submittedAt)}</span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <CaretDown className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <CaretRight className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  {plan.steps.length > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>Progress</span>
                        <span>{completedSteps}/{plan.steps.length} steps</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                          style={{ width: `${(completedSteps / plan.steps.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800/50 p-3 space-y-4">
                    {/* Description */}
                    {plan.description && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Description</p>
                        <p className="text-sm text-zinc-300">{plan.description}</p>
                      </div>
                    )}

                    {/* Steps */}
                    {plan.steps.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">Steps</p>
                        <div className="space-y-2">
                          {plan.steps.map((step, i) => (
                            <div
                              key={step.id}
                              className="flex items-start gap-2 text-sm"
                            >
                              {step.status === 'completed' ? (
                                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                              ) : step.status === 'in_progress' ? (
                                <Play className="w-4 h-4 text-purple-400 mt-0.5" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-zinc-600 mt-0.5" />
                              )}
                              <span className={step.status === 'completed' ? 'text-zinc-500 line-through' : ''}>
                                {step.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Updates */}
                    {plan.updates.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">Updates</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {plan.updates.slice().reverse().map(update => (
                            <div
                              key={update.id}
                              className="flex gap-2 text-sm bg-zinc-800/30 rounded-lg p-2"
                            >
                              {update.type === 'blocker' ? (
                                <WarningCircle className="w-4 h-4 text-red-400 shrink-0" />
                              ) : update.type === 'completed' ? (
                                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-zinc-300">{update.message}</p>
                                <p className="text-xs text-zinc-500 mt-1">
                                  {formatTime(update.timestamp)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {plan.status === 'pending' && (
                      <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                        <button
                          onClick={() => handleAction(plan.id, 'approve')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(plan.id, 'reject', { reason: 'Needs revision' })}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                    
                    {plan.status === 'approved' && (
                      <div className="pt-2 border-t border-zinc-800/50">
                        <button
                          onClick={() => handleAction(plan.id, 'start')}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Start Execution
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Request Plan Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Request Plan from Agent
            </h3>
            
            {/* Agent Selector */}
            <div className="mb-4">
              <label className="text-sm text-zinc-400 mb-2 block">Select Agent</label>
              <div className="grid gap-2">
                {HEAD_AGENTS.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      selectedAgent === agent.id
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                        : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <AgentIcon agentId={agent.id} size={32} />
                    <div className="text-left">
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-xs text-zinc-500">{agent.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Prompt */}
            <div className="mb-6">
              <label className="text-sm text-zinc-400 mb-2 block">
                What should they plan? (optional)
              </label>
              <textarea
                value={requestPrompt}
                onChange={(e) => setRequestPrompt(e.target.value)}
                placeholder="e.g., Increase Calc Pack conversions to 10%..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                rows={3}
              />
              <p className="text-xs text-zinc-500 mt-1">
                Leave empty to ask them to plan based on their current goals
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setSelectedAgent('');
                  setRequestPrompt('');
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestPlan}
                disabled={!selectedAgent || requesting}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {requesting ? (
                  <ArrowsClockwise className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Request Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
