"use client";

import { useState, useEffect } from "react";
import { Plus, Calendar, Tag, MoreHorizontal } from "lucide-react";

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;
  assignedTo?: string;
  dueDate?: number;
  tags?: string[];
}

interface TaskBoardKanbanProps {
  onTaskSelect?: (taskId: string) => void;
  selectedTaskId?: string | null;
}

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-zinc-800 text-zinc-300 border-zinc-700",
  medium: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  high: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  urgent: "bg-red-500/10 text-red-300 border-red-500/20",
};

export function TaskBoardKanban({ onTaskSelect, selectedTaskId }: TaskBoardKanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  }

  function handleDragStart(taskId: string) {
    setDraggingTask(taskId);
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    if (draggingTask) {
      updateTaskStatus(draggingTask, status);
      setDraggingTask(null);
    }
  }

  function formatDate(timestamp?: number) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-4 px-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          return (
            <div
              key={column.id}
              className="w-80 rounded-xl bg-zinc-900/60 border border-zinc-800/70 backdrop-blur-sm"
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/70">
                <h3 className="font-medium text-zinc-100">
                  {column.label}
                  <span className="ml-2 text-xs text-zinc-500">
                    {columnTasks.length}
                  </span>
                </h3>
                <button className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
                  <Plus className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-2 p-3">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onClick={() => onTaskSelect?.(task.id)}
                    className={`rounded-lg border bg-zinc-950/40 p-3 cursor-pointer transition-colors hover:bg-zinc-900/60 hover:border-zinc-700 ${
                      selectedTaskId === task.id ? "border-indigo-500/50 ring-1 ring-indigo-500/30" : "border-zinc-800/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-zinc-100 leading-snug line-clamp-2">
                        {task.title}
                      </h4>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          PRIORITY_COLORS[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        {task.assignedTo && (
                          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px] text-zinc-200">
                            {task.assignedTo.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-zinc-500">
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                      {task.tags && task.tags.length > 0 && (
                        <Tag className="w-3 h-3 text-zinc-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
