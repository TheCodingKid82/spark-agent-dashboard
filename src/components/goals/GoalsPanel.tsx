'use client';

import { useState, useEffect } from 'react';

interface Goal {
  id: string;
  agentId: string;
  title: string;
  description: string;
  type: 'long-term' | 'ongoing' | 'milestone';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed';
  metrics?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

const AGENTS = [
  { id: 'all', name: 'All Agents' },
  { id: 'atlas', name: 'Atlas (Announcements)' },
  { id: 'apollo', name: 'Apollo (Agency)' },
  { id: 'artemis', name: 'Artemis (Funnels)' },
  { id: 'maia', name: 'Maia (Engineer)' },
  { id: 'orpheus', name: 'Orpheus (Engineer)' },
  { id: 'callisto', name: 'Callisto (Engineer)' },
  { id: 'iris', name: 'Iris (Customer Intel)' },
];

const PRIORITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const TYPE_ICONS = {
  'long-term': '🎯',
  'ongoing': '🔄',
  'milestone': '🏁',
};

export default function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>('');
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    agentId: 'all',
    title: '',
    description: '',
    type: 'ongoing' as Goal['type'],
    priority: 'medium' as Goal['priority'],
    metrics: '',
  });

  useEffect(() => {
    fetchGoals();
  }, [filterAgent]);

  const fetchGoals = async () => {
    try {
      const url = filterAgent 
        ? `/api/goals?agentId=${filterAgent}&status=active`
        : '/api/goals?status=active';
      const res = await fetch(url);
      const data = await res.json();
      setGoals(data.goals || []);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingGoal) {
        await fetch('/api/goals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingGoal.id, ...formData }),
        });
      } else {
        await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      
      setShowForm(false);
      setEditingGoal(null);
      setFormData({
        agentId: 'all',
        title: '',
        description: '',
        type: 'ongoing',
        priority: 'medium',
        metrics: '',
      });
      fetchGoals();
    } catch (error) {
      console.error('Failed to save goal:', error);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      agentId: goal.agentId,
      title: goal.title,
      description: goal.description,
      type: goal.type,
      priority: goal.priority,
      metrics: goal.metrics || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return;
    
    try {
      await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
      fetchGoals();
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  const handlePause = async (goal: Goal) => {
    try {
      await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: goal.id, 
          status: goal.status === 'paused' ? 'active' : 'paused' 
        }),
      });
      fetchGoals();
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🎯 Agent Goals
        </h2>
        <div className="flex gap-2">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-zinc-800 text-white text-sm rounded px-2 py-1 border border-zinc-700"
          >
            <option value="">All Agents</option>
            {AGENTS.filter(a => a.id !== 'all').map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditingGoal(null);
              setFormData({
                agentId: filterAgent || 'all',
                title: '',
                description: '',
                type: 'ongoing',
                priority: 'medium',
                metrics: '',
              });
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded"
          >
            + Add Goal
          </button>
        </div>
      </div>

      {/* Goal Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingGoal ? 'Edit Goal' : 'New Goal'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400">Assign To</label>
                <select
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 border border-zinc-700 mt-1"
                >
                  {AGENTS.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 border border-zinc-700 mt-1"
                  placeholder="e.g., Maximize Announcements App CVR"
                  required
                />
              </div>
              
              <div>
                <label className="text-sm text-zinc-400">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 border border-zinc-700 mt-1 h-24"
                  placeholder="Detailed description of what the agent should work towards..."
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Goal['type'] })}
                    className="w-full bg-zinc-800 text-white rounded px-3 py-2 border border-zinc-700 mt-1"
                  >
                    <option value="ongoing">🔄 Ongoing</option>
                    <option value="long-term">🎯 Long-term</option>
                    <option value="milestone">🏁 Milestone</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm text-zinc-400">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Goal['priority'] })}
                    className="w-full bg-zinc-800 text-white rounded px-3 py-2 border border-zinc-700 mt-1"
                  >
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400">Success Metrics (optional)</label>
                <input
                  type="text"
                  value={formData.metrics}
                  onChange={(e) => setFormData({ ...formData, metrics: e.target.value })}
                  className="w-full bg-zinc-800 text-white rounded px-3 py-2 border border-zinc-700 mt-1"
                  placeholder="e.g., CVR > 5%, MRR > $50k"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingGoal(null);
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  {editingGoal ? 'Update' : 'Create'} Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goals List */}
      {loading ? (
        <div className="text-zinc-500 text-center py-8">Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="text-zinc-500 text-center py-8">
          No goals set. Add goals to give agents long-term direction.
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => (
            <div
              key={goal.id}
              className={`bg-zinc-800/50 rounded-lg p-4 border ${
                goal.status === 'paused' ? 'border-zinc-700 opacity-60' : 'border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{TYPE_ICONS[goal.type]}</span>
                    <h3 className="font-medium text-white">{goal.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_COLORS[goal.priority]}`}>
                      {goal.priority}
                    </span>
                    {goal.status === 'paused' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                        paused
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mb-2">{goal.description}</p>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>
                      👤 {AGENTS.find(a => a.id === goal.agentId)?.name || goal.agentId}
                    </span>
                    {goal.metrics && <span>📊 {goal.metrics}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handlePause(goal)}
                    className="text-zinc-500 hover:text-yellow-400 p-1"
                    title={goal.status === 'paused' ? 'Resume' : 'Pause'}
                  >
                    {goal.status === 'paused' ? '▶️' : '⏸️'}
                  </button>
                  <button
                    onClick={() => handleEdit(goal)}
                    className="text-zinc-500 hover:text-blue-400 p-1"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
