'use client';

import { useState, useEffect } from 'react';
import { 
  X,
  ChatCircle,
  PaperPlane,
  Clock,
  Flag,
  User,
  Tag,
  CheckCircle
} from '@phosphor-icons/react';
import { AgentIcon } from '@/lib/icons';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  task_id: string;
  author_id: string;
  author_type: string;
  content: string;
  mentions?: string[];
  created_at: string;
}

interface TaskDetailViewProps {
  taskId: string;
  onClose: () => void;
  onStatusChange?: (status: Task['status']) => void;
}

const STATUS_OPTIONS: Task['status'][] = ['inbox', 'assigned', 'in_progress', 'review', 'done'];
const PRIORITY_COLORS = {
  low: 'text-zinc-500',
  medium: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

export function TaskDetailView({ taskId, onClose, onStatusChange }: TaskDetailViewProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      if (data.success) {
        setTask(data.task);
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
    const interval = setInterval(fetchTask, 5000);
    return () => clearInterval(interval);
  }, [taskId]);

  const handleStatusChange = async (newStatus: Task['status']) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, updated_by: 'current-user' }),
      });
      fetchTask();
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          content: newComment,
          author_id: 'current-user',
          author_type: 'human'
        }),
      });
      setNewComment('');
      fetchTask();
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-xl p-8">
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-xl p-8">
          <p className="text-zinc-400">Task not found</p>
          <button onClick={onClose} className="mt-4 text-blue-400">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as Task['status'])}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <Flag className={`w-4 h-4 ${PRIORITY_COLORS[task.priority]}`} weight="fill" />
            </div>
            <h2 className="text-xl font-semibold text-white">{task.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left: Task Details */}
          <div className="w-1/3 border-r border-zinc-800 p-6 space-y-6 overflow-y-auto">
            {/* Description */}
            {task.description && (
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Description</h4>
                <p className="text-sm text-zinc-300">{task.description}</p>
              </div>
            )}

            {/* Meta */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400">Created by:</span>
                <AgentIcon agentId={task.created_by} size={20} />
                <span className="text-zinc-200 capitalize">{task.created_by}</span>
              </div>
              
              {task.assigned_to && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-400">Assigned to:</span>
                  <AgentIcon agentId={task.assigned_to} size={20} />
                  <span className="text-zinc-200 capitalize">{task.assigned_to}</span>
                </div>
              )}

              {task.due_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-400">Due:</span>
                  <span className="text-zinc-200">{formatDate(task.due_date)}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map(tag => (
                    <span 
                      key={tag}
                      className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Comments */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <ChatCircle className="w-4 h-4" />
                Discussion ({messages.length})
              </h4>

              {messages.length === 0 ? (
                <p className="text-zinc-500 text-sm">No comments yet. Start the discussion!</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <AgentIcon agentId={msg.author_id} size={32} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-zinc-200 capitalize">
                          {msg.author_id}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleSubmitComment} className="p-4 border-t border-zinc-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment... Use @agent to mention"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
                >
                  <PaperPlane className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailView;
