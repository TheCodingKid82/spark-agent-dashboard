"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority, TaskBoard as TaskBoardType } from '@/lib/tasks/types';

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'bg-zinc-700' },
  { key: 'todo', label: 'To Do', color: 'bg-blue-600' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-yellow-600' },
  { key: 'review', label: 'Review', color: 'bg-purple-600' },
  { key: 'done', label: 'Done', color: 'bg-green-600' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'border-l-zinc-500',
  medium: 'border-l-blue-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

interface Props {
  agentId: string;
  agentName: string;
  currentUserId?: string;
}

export default function TaskBoard({ agentId, agentName, currentUserId = 'andrew' }: Props) {
  const [board, setBoard] = useState<TaskBoardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as TaskPriority });
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?agentId=${agentId}&board=true&agentName=${encodeURIComponent(agentName)}`);
      if (res.ok) {
        const data = await res.json();
        setBoard(data);
      }
    } catch (err) {
      console.error('Failed to fetch board:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, agentName]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          createdBy: currentUserId,
          status: 'todo',
        }),
      });
      
      if (res.ok) {
        setNewTask({ title: '', description: '', priority: 'medium' });
        setShowAddTask(false);
        fetchBoard();
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchBoard();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: TaskStatus) => {
    if (draggedTask && draggedTask.status !== status) {
      handleStatusChange(draggedTask.id, status);
    }
    setDraggedTask(null);
  };

  if (loading) {
    return <div className="p-4 text-zinc-400">Loading tasks...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-white">{agentName}'s Tasks</h2>
          <p className="text-sm text-zinc-400">{board?.totalCount || 0} total tasks</p>
        </div>
        <button
          onClick={() => setShowAddTask(true)}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
        >
          + Add Task
        </button>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">New Task for {agentName}</h3>
            <input
              type="text"
              placeholder="Task title..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white mb-3"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)..."
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white mb-3 h-24 resize-none"
            />
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white mb-4"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Create Task
              </button>
              <button
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className="w-64 flex flex-col bg-zinc-800/50 rounded-lg"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.key)}
            >
              {/* Column Header */}
              <div className={`${col.color} px-3 py-2 rounded-t-lg flex items-center justify-between`}>
                <span className="font-medium text-white text-sm">{col.label}</span>
                <span className="text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded-full">
                  {board?.columns[col.key]?.length || 0}
                </span>
              </div>
              
              {/* Tasks */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">
                {board?.columns[col.key]?.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className={`bg-zinc-700 rounded-lg p-3 cursor-move border-l-4 ${PRIORITY_COLORS[task.priority]} hover:bg-zinc-600 transition-colors`}
                  >
                    <p className="text-white text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                      <span className="capitalize">{task.priority}</span>
                      <span>•</span>
                      <span>by {task.createdBy}</span>
                    </div>
                  </div>
                ))}
                {(!board?.columns[col.key] || board.columns[col.key].length === 0) && (
                  <div className="text-center text-zinc-500 text-sm py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
