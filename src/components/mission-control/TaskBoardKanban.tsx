"use client";

import { useState, useEffect } from "react";
import { Plus, Calendar, Tag, MoreHorizontal } from "@phosphor-icons/react";

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

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "inbox", label: "Inbox", color: "bg-gray-100" },
  { id: "assigned", label: "Assigned", color: "bg-blue-50" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-50" },
  { id: "review", label: "Review", color: "bg-purple-50" },
  { id: "done", label: "Done", color: "bg-green-50" },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-gray-200 text-gray-700",
  medium: "bg-blue-200 text-blue-700",
  high: "bg-amber-200 text-amber-700",
  urgent: "bg-red-200 text-red-700",
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-4 min-w-max pb-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          return (
            <div
              key={column.id}
              className={`w-72 rounded-lg ${column.color} p-3`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">
                  {column.label}
                  <span className="ml-2 text-xs text-gray-500">
                    ({columnTasks.length})
                  </span>
                </h3>
                <button className="p-1 hover:bg-white/50 rounded">
                  <Plus className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onClick={() => onTaskSelect?.(task.id)}
                    className={`bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                      selectedTaskId === task.id ? "ring-2 ring-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
                        {task.title}
                      </h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          PRIORITY_COLORS[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        {task.assignedTo && (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                            {task.assignedTo.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                      {task.tags && task.tags.length > 0 && (
                        <Tag className="w-3 h-3 text-gray-400" />
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
