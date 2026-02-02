import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();
  },
});

export const getByAuthor = query({
  args: { authorId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .take(limit);
  },
});

export const getById = query({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutations
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    authorId: v.string(),
    authorType: v.union(v.literal("agent"), v.literal("human")),
    content: v.string(),
    messageType: v.optional(v.union(v.literal("comment"), v.literal("system"), v.literal("activity"))),
    parentId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // Extract @mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(args.content)) !== null) {
      mentions.push(match[1]);
    }
    
    const messageId = await ctx.db.insert("messages", {
      taskId: args.taskId,
      authorId: args.authorId,
      authorType: args.authorType,
      content: args.content,
      messageType: args.messageType ?? "comment",
      parentId: args.parentId,
      mentions,
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      actorId: args.authorId,
      actorType: args.authorType,
      action: "commented",
      targetType: "task",
      targetId: args.taskId,
      metadata: { messageId, mentions },
    });
    
    // Create notifications for @mentions
    for (const mention of mentions) {
      if (mention !== args.authorId) {
        await ctx.db.insert("notifications", {
          recipientId: mention,
          senderId: args.authorId,
          type: "mention",
          title: "You were mentioned",
          message: args.content.slice(0, 100),
          targetType: "task",
          targetId: args.taskId,
          read: false,
        });
      }
    }
    
    // Auto-subscribe commenter
    await ctx.db.insert("subscriptions", {
      subscriberId: args.authorId,
      targetType: "task",
      targetId: args.taskId,
      autoSubscribed: true,
    }).catch(() => {
      // Ignore duplicate subscription errors
    });
    
    // Notify other subscribers
    const subscribers = await ctx.db
      .query("subscriptions")
      .withIndex("by_target", (q) => 
        q.eq("targetType", "task").eq("targetId", args.taskId)
      )
      .collect();
    
    for (const sub of subscribers) {
      if (sub.subscriberId !== args.authorId && !mentions.includes(sub.subscriberId)) {
        await ctx.db.insert("notifications", {
          recipientId: sub.subscriberId,
          senderId: args.authorId,
          type: "comment",
          title: "New comment on task",
          message: args.content.slice(0, 100),
          targetType: "task",
          targetId: args.taskId,
          read: false,
        });
      }
    }
    
    return messageId;
  },
});

export const remove = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
