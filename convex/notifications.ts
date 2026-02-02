import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const getByRecipient = query({
  args: { recipientId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
      .order("desc")
      .take(limit);
  },
});

export const getUnreadByRecipient = query({
  args: { recipientId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipient_read", (q) => 
        q.eq("recipientId", args.recipientId).eq("read", false)
      )
      .order("desc")
      .take(limit);
  },
});

export const getUnreadCount = query({
  args: { recipientId: v.string() },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_read", (q) => 
        q.eq("recipientId", args.recipientId).eq("read", false)
      )
      .collect();
    return notifications.length;
  },
});

export const getById = query({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutations
export const create = mutation({
  args: {
    recipientId: v.string(),
    senderId: v.optional(v.string()),
    type: v.union(v.literal("mention"), v.literal("assignment"), v.literal("comment"), v.literal("status_change"), v.literal("system")),
    title: v.string(),
    message: v.string(),
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      senderId: args.senderId,
      type: args.type,
      title: args.title,
      message: args.message,
      targetType: args.targetType,
      targetId: args.targetId,
      read: false,
    });
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
    return await ctx.db.get(args.id);
  },
});

export const markAllAsRead = mutation({
  args: { recipientId: v.string() },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", args.recipientId))
      .collect();
    
    for (const n of notifications) {
      if (!n.read) {
        await ctx.db.patch(n._id, { read: true });
      }
    }
    
    return { success: true, marked: notifications.filter(n => !n.read).length };
  },
});

export const remove = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
