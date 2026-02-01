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
  Lightning,
  Flag,
  ChatCircleText,
  Pulse,
  Seal,
} from '@phosphor-icons/react';
import { AgentIcon } from '@/lib/icons';
import ReactMarkdown from 'react-markdown';

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
  type: 'progress' | 'blocker' | 'completed' | 'milestone' | 'note' | 'approval';
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
  
  // Edit plan state
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editFeedback, setEditFeedback] = useState('');
  const [sendingEdit, setSendingEdit] = useState(false);
  
  // Check-in state
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  
  // Auto-approve state - persist to localStorage
  const [autoApprove, setAutoApprove] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('autoApprove') === 'true';
    }
    return false;
  });

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
    // Fast refresh (15s) when there are in_progress plans, otherwise 30s
    const hasActivePlans = plans.some(p => p.status === 'in_progress');
    const interval = setInterval(fetchData, hasActivePlans ? 15000 : 30000);
    return () => clearInterval(interval);
  }, [plans.length]);

  // Persist auto-approve to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoApprove', String(autoApprove));
    }
  }, [autoApprove]);

  // Auto-approve pending approval requests when enabled
  useEffect(() => {
    if (!autoApprove) return;
    
    const approvalRequests = plans.flatMap(plan => 
      (plan.updates || [])
        .filter(u => u.type === 'approval' && !u.message.startsWith('✅') && !u.message.startsWith('❌'))
        .map(u => ({ ...u, plan }))
    );
    
    // Auto-approve each pending request
    approvalRequests.forEach(req => {
      handleApprovalResponse(req.plan.id, req.id, true);
    });
  }, [plans, autoApprove]);

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

  const handleCheckIn = async (plan: Plan) => {
    setCheckingIn(plan.id);
    try {
      const message = `**CHECK-IN REQUEST from Command Center**

Report your current progress on plan: "${plan.objective}"

Please provide:
1. What have you completed since the last update?
2. What are you currently working on?
3. Any blockers or issues?
4. Estimated time to completion?

Post your update via either:
- POST /api/plans/${plan.id}/updates with { message, type }
- POST /api/plans/update with { planId: "${plan.id}", message, type }

Types: progress | blocker | completed | milestone | note`;

      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'andrew',
          to: plan.agentId,
          content: message,
        }),
      });
      
      if (res.ok) {
        // Refresh to show the request was sent
        fetchData();
      }
    } catch (error) {
      console.error('Check-in failed:', error);
    } finally {
      setCheckingIn(null);
    }
  };

  const handleApprovalResponse = async (planId: string, updateId: string, approved: boolean) => {
    try {
      // Find the plan and update
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;
      
      const update = plan.updates.find(u => u.id === updateId);
      if (!update) return;
      
      // Send response to agent
      const responseMessage = approved 
        ? `✅ **APPROVED:** ${update.message}\n\nYou may proceed with this action.`
        : `❌ **DENIED:** ${update.message}\n\nPlease do not proceed with this action. Contact leadership for clarification if needed.`;
      
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'andrew',
          to: plan.agentId,
          content: responseMessage,
        }),
      });
      
      // Add a note update about the approval decision
      await fetch('/api/plans/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          message: `${approved ? '✅ Approved' : '❌ Denied'}: ${update.message}`,
          type: 'note',
        }),
      });
      
      fetchData();
    } catch (error) {
      console.error('Approval response failed:', error);
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
          from: 'andrew',
          to: selectedAgent,
          content: message,
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

  const handleSendEditBack = async () => {
    if (!editingPlan) return;
    
    setSendingEdit(true);
    try {
      const message = `**Plan Revision Requested**

Your plan "${editingPlan.objective}" needs changes.

**Feedback:**
${editFeedback}

Please revise and resubmit your plan via POST /api/plans. Keep the same objective but address the feedback above.`;
      
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'andrew',
          to: editingPlan.agentId,
          content: message,
        }),
      });
      
      if (res.ok) {
        // Reject the plan
        await handleAction(editingPlan.id, 'reject', { reason: editFeedback });
        setEditingPlan(null);
        setEditFeedback('');
        alert(`Revision request sent to ${editingPlan.agentName}.`);
      }
    } catch (error) {
      console.error('Send edit failed:', error);
    } finally {
      setSendingEdit(false);
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

      {/* Approval Requests Section */}
      {(() => {
        // Filter out approval requests that have already been handled
        // (check if there's a note update that references the approval message)
        const approvalRequests = plans.flatMap(plan => {
          const noteMessages = (plan.updates || [])
            .filter(u => u.type === 'note')
            .map(u => u.message);
          
          return (plan.updates || [])
            .filter(u => u.type === 'approval')
            // Exclude if already handled (note exists with ✅ or ❌ prefix referencing this message)
            .filter(u => !noteMessages.some(note => 
              (note.startsWith('✅ Approved:') || note.startsWith('❌ Denied:')) && 
              note.includes(u.message.slice(0, 50))
            ))
            .map(u => ({ ...u, plan }));
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        if (approvalRequests.length === 0) return null;
        
        return (
          <div className="p-3 border-b border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                <Seal className="w-4 h-4" />
                Approval Requests ({approvalRequests.length})
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">Auto-approve</span>
                <button
                  onClick={() => setAutoApprove(!autoApprove)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${
                    autoApprove ? 'bg-green-500' : 'bg-zinc-600'
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                    autoApprove ? 'left-4' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {approvalRequests.map(req => (
                <div key={req.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AgentIcon agentId={req.plan.agentId} size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-200">{req.message}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {req.plan.agentName} • {req.plan.objective}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleApprovalResponse(req.plan.id, req.id, true)}
                      className="p-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleApprovalResponse(req.plan.id, req.id, false)}
                      className="p-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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

                    {/* Updates - Live Activity Feed */}
                    <div className={`${plan.status === 'in_progress' ? 'bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                          {plan.status === 'in_progress' && <Pulse className="w-3 h-3 text-green-400 animate-pulse" />}
                          Live Updates ({plan.updates.length})
                        </p>
                        {plan.updates.length > 0 && (
                          <span className="text-[10px] text-zinc-600">
                            Last: {formatTime(plan.updates[plan.updates.length - 1]?.timestamp)}
                          </span>
                        )}
                      </div>
                      {plan.updates.length === 0 ? (
                        <p className="text-xs text-zinc-600 italic">No updates yet</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {plan.updates.slice().reverse().map(update => {
                            const updateTime = new Date(update.timestamp);
                            const timeStr = updateTime.toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            });
                            const dateStr = updateTime.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            });
                            
                            return (
                              <div
                                key={update.id}
                                className={`flex gap-2 text-sm rounded-lg p-2.5 ${
                                  update.type === 'blocker' ? 'bg-red-500/10 border border-red-500/20' :
                                  update.type === 'approval' ? 'bg-amber-500/10 border border-amber-500/20' :
                                  update.type === 'milestone' ? 'bg-green-500/10 border border-green-500/20' :
                                  update.type === 'completed' ? 'bg-green-500/10 border border-green-500/20' :
                                  'bg-zinc-800/50'
                                }`}
                              >
                                <div className="shrink-0 mt-0.5">
                                  {update.type === 'blocker' && <WarningCircle className="w-4 h-4 text-red-400" />}
                                  {update.type === 'approval' && <Seal className="w-4 h-4 text-amber-400" />}
                                  {update.type === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                                  {update.type === 'milestone' && <Flag className="w-4 h-4 text-green-400" />}
                                  {update.type === 'progress' && <Lightning className="w-4 h-4 text-indigo-400" />}
                                  {update.type === 'note' && <ChatCircleText className="w-4 h-4 text-zinc-400" />}
                                  {!['blocker', 'approval', 'completed', 'milestone', 'progress', 'note'].includes(update.type) && (
                                    <FileText className="w-4 h-4 text-zinc-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-zinc-200 prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:text-zinc-200 prose-headings:font-medium prose-h3:text-sm prose-h2:text-base">
                                    <ReactMarkdown>{update.message}</ReactMarkdown>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      {timeStr}
                                    </span>
                                    <span className="text-[10px] text-zinc-600">
                                      {dateStr}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      update.type === 'blocker' ? 'bg-red-500/20 text-red-400' :
                                      update.type === 'approval' ? 'bg-amber-500/20 text-amber-400' :
                                      update.type === 'milestone' ? 'bg-green-500/20 text-green-400' :
                                      update.type === 'completed' ? 'bg-green-500/20 text-green-400' :
                                      update.type === 'progress' ? 'bg-indigo-500/20 text-indigo-400' :
                                      'bg-zinc-700 text-zinc-400'
                                    }`}>
                                      {update.type}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

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
                          onClick={() => {
                            setEditingPlan(plan);
                            setEditFeedback('');
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Edit & Return
                        </button>
                        <button
                          onClick={() => handleAction(plan.id, 'reject', { reason: 'Rejected' })}
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
                    
                    {plan.status === 'in_progress' && (
                      <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                        <button
                          onClick={() => handleCheckIn(plan)}
                          disabled={checkingIn === plan.id}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowsClockwise className={`w-4 h-4 ${checkingIn === plan.id ? 'animate-spin' : ''}`} />
                          {checkingIn === plan.id ? 'Requesting...' : 'Check In'}
                        </button>
                        <button
                          onClick={() => handleAction(plan.id, 'complete')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark Complete
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
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

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Edit & Return Plan
            </h3>
            
            {/* Plan Summary */}
            <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AgentIcon agentId={editingPlan.agentId} size={24} />
                <span className="font-medium">{editingPlan.agentName}</span>
              </div>
              <p className="text-sm text-zinc-300">{editingPlan.objective}</p>
              {editingPlan.steps.length > 0 && (
                <div className="mt-2 text-xs text-zinc-500">
                  {editingPlan.steps.length} steps planned
                </div>
              )}
            </div>

            {/* Feedback */}
            <div className="mb-6">
              <label className="text-sm text-zinc-400 mb-2 block">
                What changes do you want?
              </label>
              <textarea
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                placeholder="e.g., Add more specific metrics, include timeline milestones, consider collaboration with Maia..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
                rows={4}
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingPlan(null);
                  setEditFeedback('');
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEditBack}
                disabled={!editFeedback.trim() || sendingEdit}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {sendingEdit ? (
                  <ArrowsClockwise className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Send Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
