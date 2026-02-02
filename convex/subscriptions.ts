import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const getBySubscriber = query({
  args: { subscriberId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriberId", args.subscriberId))
      .order("desc")
      .collect();
  },
});

export const getByTarget = query({
  args: { 
    targetType: v.union(v.literal("task"), v.literal("document")),
    targetId: v.string() 
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_target", (q) => 
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .order("desc")
      .collect();
  },
});

export const checkSubscription = query({
  args: {
    subscriberId: v.string(),
    targetType: v.union(v.literal("task"), v.literal("document")),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_unique", (q) => 
        q.eq("subscriberId", args.subscriberId)
         .eq("targetType", args.targetType)
         .eq("targetId", args.targetId)
      )
      .collect();
    return subs[0] || null;
  },
});

export const getById = query({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutations
export const subscribe = mutation({
  args: {
    subscriberId: v.string(),
    targetType: v.union(v.literal("task"), v.literal("document")),
    targetId: v.string(),
    autoSubscribed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if already subscribed
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_unique", (q) => 
        q.eq("subscriberId", args.subscriberId)
         .eq("targetType", args.targetType)
         .eq("targetId", args.targetId)
      )
      .first();
    
    if (existing) {
      // Update autoSubscribed if needed
      if (args.autoSubscribed !== undefined && existing.autoSubscribed !== args.autoSubscribed) {
        await ctx.db.patch(existing._id, { autoSubscribed: args.autoSubscribed });
      }
      return existing._id;
    }
    
    return await ctx.db.insert("subscriptions", {
      subscriberId: args.subscriberId,
      targetType: args.targetType,
      targetId: args.targetId,
      autoSubscribed: args.autoSubscribed ?? false,
    });
  },
});

export const unsubscribe = mutation({
  args: {
    subscriberId: v.string(),
    targetType: v.union(v.literal("task"), v.literal("document")),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_unique", (q) => 
        q.eq("subscriberId", args.subscriberId)
         .eq("targetType", args.targetType)
         .eq("targetId", args.targetId)
      )
      .first();
    
    if (sub) {
      await ctx.db.delete(sub._id);
    }
    
    return { success: true };
  },
});

export const remove = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
