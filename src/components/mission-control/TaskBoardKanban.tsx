"use client";

import { useState } from "react";
import { Plus, Calendar, Tag, GripVertical, User } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "@/components/Toast";

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface Task {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;
  assignedTo?: string;
  dueDate?: number;
  tags?: string[];
  _creationTime: number;
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
  const tasks = useQuery(api.tasks.getAll, { limit: 500 });
  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const { showToast } = useToast();
  
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [creating, setCreating] = useState<TaskStatus | null>(null);

  async function handleCreateTask(status: TaskStatus) {
    if (creating) return;
    setCreating(status);
    
    try {
      // Create task - stays in inbox until user fills in details
      const taskId = await createTask({
        title: "New task",
        description: "",
        status: "inbox", // Always start in inbox, no auto-routing
        priority: "medium",
        createdBy: "andrew",
      });
      
      if (taskId) {
        onTaskSelect?.(taskId); // Open for editing
        showToast("Task created - fill in details to assign", "info");
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      showToast("Failed to create task", "error");
    } finally {
      setCreating(null);
    }
  }

  async function handleUpdateStatus(taskId: Id<"tasks">, newStatus: TaskStatus, oldStatus?: TaskStatus) {
    try {
      // Get the task to find assignee and old status
      const task = tasks?.find(t => t._id === taskId);
      const effectiveOldStatus = oldStatus ?? task?.status;
      
      await updateTask({
        id: taskId,
        updatedBy: "andrew",
        status: newStatus,
      });

      // Trigger agent if:
      // 1. Moving to assigned column with an assignee
      // 2. Moving from done back to assigned (retry)
      const shouldTrigger = task?.assignedTo && (
        (newStatus === 'assigned' && effectiveOldStatus === 'done') || // Retry
        (newStatus === 'assigned' && effectiveOldStatus === 'inbox')   // New assignment
      );

      if (shouldTrigger) {
        const action = effectiveOldStatus === 'done' ? 'retry' : 'assigned';
        fetch('/api/agents/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: task.assignedTo,
            taskId: taskId,
            action,
          }),
        }).then(() => {
          showToast(`Triggered ${task.assignedTo} to work on task`, 'success');
        }).catch(err => {
          console.error('Failed to trigger agent:', err);
        });
      }
    } catch (error) {
      console.error("Failed to update task:", error);
      showToast("Failed to update task", "error");
    }
  }

  function handleDragStart(taskId: string) {
    setDraggingTask(taskId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, newStatus: TaskStatus) {
    e.preventDefault();
    if (draggingTask) {
      const task = tasks?.find(t => t._id === draggingTask);
      const oldStatus = task?.status;
      handleUpdateStatus(draggingTask as Id<"tasks">, newStatus, oldStatus);
      setDraggingTask(null);
    }
  }

  function formatDate(timestamp?: number) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Loading state
  if (tasks === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto py-4">
      <div className="flex gap-4 min-w-max pb-4 px-4">
        {COLUMNS.map((column) => {
          const columnTasks = (tasks || []).filter((t) => t.status === column.id);
          const isCreatingHere = creating === column.id;
          
          return (
            <div
              key={column.id}
              className="w-80 rounded-xl bg-zinc-900/60 border border-zinc-800/70 backdrop-blur-sm flex flex-col max-h-[calc(100vh-12rem)]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/70">
                <h3 className="font-medium text-zinc-100">
                  {column.label}
                  <span className="ml-2 text-xs text-zinc-500">
                    {columnTasks.length}
                  </span>
                </h3>
                <button
                  className={`p-1.5 rounded-lg transition-colors ${
                    isCreatingHere 
                      ? 'bg-indigo-600 text-white' 
                      : 'hover:bg-zinc-800 text-zinc-400'
                  }`}
                  onClick={() => handleCreateTask(column.id)}
                  disabled={creating !== null}
                  title={`New ${column.label} task`}
                >
                  <Plus className={`w-4 h-4 ${isCreatingHere ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Column Body */}
              <div className="flex-1 overflow-y-auto space-y-2 p-3">
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-sm">
                    No tasks
                  </div>
                )}
                
                {columnTasks.map((task) => (
                  <div
                    key={task._id}
                    draggable
                    onDragStart={() => handleDragStart(task._id)}
                    onClick={() => onTaskSelect?.(task._id)}
                    className={`group rounded-lg border bg-zinc-950/40 p-3 cursor-pointer transition-all hover:bg-zinc-900/60 hover:border-zinc-700 ${
                      selectedTaskId === task._id 
                        ? "border-indigo-500/50 ring-1 ring-indigo-500/30" 
                        : "border-zinc-800/80"
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0 mt-0.5" />
                      
                      <div className="flex-1 min-w-0">
                        {/* Title & Priority */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm text-zinc-100 leading-snug line-clamp-2">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {task.assignedTo && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/20 capitalize">
                                {task.assignedTo}
                              </span>
                            )}
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                PRIORITY_COLORS[task.priority]
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Meta */}
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
                            <div className="flex items-center gap-1">
                              <Tag className="w-3 h-3 text-zinc-500" />
                              <span className="text-xs text-zinc-500">{task.tags.length}</span>
                            </div>
                          )}
                        </div>
                      </div>
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
