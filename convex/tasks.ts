import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Task types
export type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

// Queries
export const getAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 500;
    return await ctx.db
      .query("tasks")
      .order("desc")
      .take(limit);
  },
});

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByStatus = query({
  args: { status: v.union(
    v.literal("inbox"),
    v.literal("assigned"),
    v.literal("in_progress"),
    v.literal("review"),
    v.literal("done")
  )},
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});

export const getByAssignedTo = query({
  args: { assignedTo: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_assigned_to", (q) => q.eq("assignedTo", args.assignedTo))
      .order("desc")
      .collect();
  },
});

export const getByCreatedBy = query({
  args: { createdBy: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.createdBy))
      .order("desc")
      .collect();
  },
});

export const getBoard = query({
  handler: async (ctx) => {
    const allTasks = await ctx.db
      .query("tasks")
      .order("desc")
      .collect();
    
    return {
      inbox: allTasks.filter(t => t.status === "inbox"),
      assigned: allTasks.filter(t => t.status === "assigned"),
      in_progress: allTasks.filter(t => t.status === "in_progress"),
      review: allTasks.filter(t => t.status === "review"),
      done: allTasks.filter(t => t.status === "done"),
    };
  },
});

export const getTaskWithMessages = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;
    
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.id))
      .order("asc")
      .collect();
    
    return { task, messages };
  },
});

// Mutations
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    )),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    createdBy: v.string(),
    assignedTo: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status ?? "inbox",
      priority: args.priority ?? "medium",
      createdBy: args.createdBy,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      tags: args.tags,
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      actorId: args.createdBy,
      actorType: "agent",
      action: "created_task",
      targetType: "task",
      targetId: taskId,
      metadata: { title: args.title, status: args.status ?? "inbox" },
    });
    
    // Create notification if assigned
    if (args.assignedTo && args.assignedTo !== args.createdBy) {
      await ctx.db.insert("notifications", {
        recipientId: args.assignedTo,
        senderId: args.createdBy,
        type: "assignment",
        title: "New Task Assigned",
        message: `You have been assigned: ${args.title}`,
        targetType: "task",
        targetId: taskId,
        read: false,
      });
      
      // Auto-subscribe assignee
      await ctx.db.insert("subscriptions", {
        subscriberId: args.assignedTo,
        targetType: "task",
        targetId: taskId,
        autoSubscribed: true,
      });
    }
    
    return taskId;
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    updatedBy: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    )),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    assignedTo: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, updatedBy, ...updates } = args;
    const oldTask = await ctx.db.get(id);
    
    if (!oldTask) {
      throw new Error("Task not found");
    }
    
    const updateData: Partial<typeof oldTask> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status === "done") {
        updateData.completedAt = Date.now();
      }
    }
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
    if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    
    await ctx.db.patch(id, updateData);
    const task = await ctx.db.get(id);
    
    // Log activity
    await ctx.db.insert("activities", {
      actorId: updatedBy,
      actorType: "agent",
      action: "updated_task",
      targetType: "task",
      targetId: id,
      metadata: {
        title: task?.title,
        status: updates.status,
        oldStatus: oldTask.status,
        assigned_to: updates.assignedTo,
      },
    });
    
    // Notify subscribers on status change
    if (updates.status && updates.status !== oldTask.status) {
      const subscribers = await ctx.db
        .query("subscriptions")
        .withIndex("by_target", (q) => 
          q.eq("targetType", "task").eq("targetId", id)
        )
        .collect();
      
      for (const sub of subscribers) {
        if (sub.subscriberId !== updatedBy) {
          await ctx.db.insert("notifications", {
            recipientId: sub.subscriberId,
            senderId: updatedBy,
            type: "status_change",
            title: "Task Status Changed",
            message: `${task?.title} moved to ${updates.status}`,
            targetType: "task",
            targetId: id,
            read: false,
          });
        }
      }
    }
    
    // Notify on new assignment
    if (updates.assignedTo && updates.assignedTo !== oldTask.assignedTo && updates.assignedTo !== updatedBy) {
      await ctx.db.insert("notifications", {
        recipientId: updates.assignedTo,
        senderId: updatedBy,
        type: "assignment",
        title: "Task Assigned to You",
        message: `You have been assigned: ${task?.title}`,
        targetType: "task",
        targetId: id,
        read: false,
      });
      
      // Auto-subscribe new assignee
      await ctx.db.insert("subscriptions", {
        subscriberId: updates.assignedTo,
        targetType: "task",
        targetId: id,
        autoSubscribed: true,
      });
    }
    
    return task;
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    
    // Clean up subscriptions
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_target", (q) => 
        q.eq("targetType", "task").eq("targetId", args.id)
      )
      .collect();
    
    for (const sub of subs) {
      await ctx.db.delete(sub._id);
    }
    
    return { success: true };
  },
});
