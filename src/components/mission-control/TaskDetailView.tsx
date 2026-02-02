"use client";

import { useState } from "react";
import {
  X,
  MessageCircle,
  Send,
  Clock,
  Flag,
  User,
  Tag,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";
import { AgentIcon } from "@/lib/icons";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const STATUS_OPTIONS = ["inbox", "assigned", "in_progress", "review", "done"] as const;
type TaskStatus = (typeof STATUS_OPTIONS)[number];
type TaskPriority = "low" | "medium" | "high" | "urgent";

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-zinc-400",
  medium: "text-indigo-300",
  high: "text-amber-300",
  urgent: "text-red-300",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  inbox: "bg-zinc-700",
  assigned: "bg-blue-600",
  in_progress: "bg-amber-600",
  review: "bg-purple-600",
  done: "bg-emerald-600",
};

interface TaskDetailViewProps {
  taskId: string;
  onClose: () => void;
  onStatusChange?: (status: TaskStatus) => void;
}

export function TaskDetailView({ taskId, onClose, onStatusChange }: TaskDetailViewProps) {
  const taskData = useQuery(api.tasks.getTaskWithMessages, { 
    id: taskId as Id<"tasks"> 
  });
  const updateTask = useMutation(api.tasks.update);
  const deleteTask = useMutation(api.tasks.remove);
  const createMessage = useMutation(api.messages.create);
  
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const task = taskData?.task;
  const messages = taskData?.messages || [];

  async function handleStatusChange(newStatus: TaskStatus) {
    if (!task) return;
    try {
      await updateTask({
        id: task._id,
        updatedBy: "henry",
        status: newStatus,
      });
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting || !task) return;

    setIsSubmitting(true);
    try {
      await createMessage({
        taskId: task._id,
        content: newComment,
        authorId: "henry",
        authorType: "agent",
        messageType: "comment",
      });
      setNewComment("");
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!task) return;
    try {
      await updateTask({
        id: task._id,
        updatedBy: "andrew",
        title: editTitle,
        description: editDescription,
      });
      
      // If task is unassigned, use gateway to route it
      if (!task.assignedTo && task.status === "inbox") {
        try {
          const routeRes = await fetch("/api/tasks/route-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: editTitle,
              description: editDescription,
              taskId: task._id,
            }),
          });
          
          if (routeRes.ok) {
            const routeData = await routeRes.json();
            if (routeData.assignedTo) {
              await updateTask({
                id: task._id,
                updatedBy: "system",
                assignedTo: routeData.assignedTo,
                status: "assigned",
              });
            }
          }
        } catch (routeErr) {
          console.warn("Gateway routing unavailable:", routeErr);
        }
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  }

  async function handleDelete() {
    if (!task || !confirm("Delete this task?")) return;
    try {
      await deleteTask({ id: task._id });
      onClose();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function startEditing() {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setIsEditing(true);
  }

  // Loading state
  if (taskData === undefined) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  // Not found
  if (!task) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
          <p className="text-zinc-400 mb-4">Task not found</p>
          <button
            onClick={onClose}
            className="text-indigo-400 hover:text-indigo-300"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-zinc-800">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className={`${STATUS_COLORS[task.status]} border-0 rounded px-3 py-1 text-sm text-white font-medium cursor-pointer`}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="bg-zinc-800">
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
              <Flag className={`w-4 h-4 ${PRIORITY_COLORS[task.priority]}`} />
              <span className={`text-sm ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority}
              </span>
            </div>
            
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xl font-semibold text-white bg-transparent border-b border-zinc-700 pb-2 focus:outline-none focus:border-indigo-500"
                placeholder="Task title..."
              />
            ) : (
              <h2
                onClick={startEditing}
                className="text-xl font-semibold text-white cursor-pointer hover:text-zinc-300"
              >
                {task.title}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
                title="Delete task"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left: Task Details */}
          <div className="w-1/3 border-r border-zinc-800 p-6 space-y-6 overflow-y-auto">
            {/* Description */}
            <div>
              <h4 className="text-sm font-medium text-zinc-400 mb-2">Description</h4>
              {isEditing ? (
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Add a description..."
                />
              ) : (
                <p
                  onClick={startEditing}
                  className="text-sm text-zinc-300 cursor-pointer hover:text-zinc-200"
                >
                  {task.description || "Click to add description..."}
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400">Created by:</span>
                <AgentIcon agentId={task.createdBy} size={20} />
                <span className="text-zinc-200 capitalize">{task.createdBy}</span>
              </div>

              {task.assignedTo && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-400">Assigned to:</span>
                  <AgentIcon agentId={task.assignedTo} size={20} />
                  <span className="text-zinc-200 capitalize">{task.assignedTo}</span>
                </div>
              )}

              {task.dueDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-400">Due:</span>
                  <span className="text-zinc-200">{formatDate(task.dueDate)}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400">Created:</span>
                <span className="text-zinc-200">{formatDate(task._creationTime)}</span>
              </div>
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
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
                <MessageCircle className="w-4 h-4" />
                Discussion ({messages.length})
              </h4>

              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                  <p className="text-zinc-500 text-sm">
                    No comments yet. Start the discussion!
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg._id} className="flex gap-3">
                    <AgentIcon agentId={msg.authorId} size={32} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-zinc-200 capitalize">
                          {msg.authorId}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatDate(msg._creationTime)}
                        </span>
                      </div>
                      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2">
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
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
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
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
