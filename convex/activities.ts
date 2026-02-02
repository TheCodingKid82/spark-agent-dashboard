import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const getAll = query({
  args: { limit: v.optional(v.number()), offset: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;
    
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_creation_time", (q) => q)
      .order("desc")
      .take(limit + offset);
    
    return activities.slice(offset);
  },
});

export const getByActor = query({
  args: { actorId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("activities")
      .withIndex("by_actor", (q) => q.eq("actorId", args.actorId))
      .order("desc")
      .take(limit);
  },
});

export const getByTarget = query({
  args: { 
    targetType: v.union(v.literal("task"), v.literal("message"), v.literal("document"), v.literal("agent")),
    targetId: v.string(),
    limit: v.optional(v.number()) 
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("activities")
      .withIndex("by_target", (q) => 
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .order("desc")
      .take(limit);
  },
});

// Mutations
export const create = mutation({
  args: {
    actorId: v.string(),
    actorType: v.union(v.literal("agent"), v.literal("human"), v.literal("system")),
    action: v.string(),
    targetType: v.union(v.literal("task"), v.literal("message"), v.literal("document"), v.literal("agent")),
    targetId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      actorId: args.actorId,
      actorType: args.actorType,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      metadata: args.metadata,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
