import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("agents")
      .collect();
  },
});

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .collect();
    return agents[0] || null;
  },
});

export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const getByReportsTo = query({
  args: { reportsTo: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_reports_to", (q) => q.eq("reportsTo", args.reportsTo))
      .collect();
  },
});

// Mutations
export const createOrUpdate = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    role: v.string(),
    emoji: v.optional(v.string()),
    status: v.optional(v.string()),
    purpose: v.optional(v.string()),
    specialties: v.optional(v.array(v.string())),
    parentId: v.optional(v.string()),
    reportsTo: v.optional(v.string()),
    level: v.optional(v.string()),
    workspace: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    heartbeatCron: v.optional(v.string()),
    tools: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        role: args.role,
        emoji: args.emoji,
        status: args.status ?? existing.status,
        purpose: args.purpose,
        specialties: args.specialties,
        parentId: args.parentId,
        reportsTo: args.reportsTo,
        level: args.level ?? existing.level,
        workspace: args.workspace,
        sessionKey: args.sessionKey,
        heartbeatCron: args.heartbeatCron,
        tools: args.tools,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("agents", {
        id: args.id,
        name: args.name,
        role: args.role,
        emoji: args.emoji,
        status: args.status ?? "offline",
        purpose: args.purpose,
        specialties: args.specialties,
        parentId: args.parentId,
        reportsTo: args.reportsTo,
        level: args.level ?? "specialist",
        workspace: args.workspace,
        sessionKey: args.sessionKey,
        heartbeatCron: args.heartbeatCron,
        tools: args.tools,
      });
    }
  },
});

export const updateStatus = mutation({
  args: {
    id: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .first();
    
    if (agent) {
      await ctx.db.patch(agent._id, { status: args.status });
    }
    
    return { success: true };
  },
});

export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .first();
    
    if (agent) {
      await ctx.db.delete(agent._id);
    }
    
    return { success: true };
  },
});

export const syncFromRoster = mutation({
  args: {
    agents: v.array(v.object({
      id: v.string(),
      name: v.string(),
      role: v.string(),
      reportsTo: v.optional(v.string()),
      sessionKey: v.optional(v.string()),
      workspace: v.optional(v.string()),
      heartbeatCron: v.optional(v.string()),
      level: v.optional(v.string()),
      tools: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    for (const agent of args.agents) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_id", (q) => q.eq("id", agent.id))
        .first();
      
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: agent.name,
          role: agent.role,
          reportsTo: agent.reportsTo,
          sessionKey: agent.sessionKey,
          workspace: agent.workspace,
          heartbeatCron: agent.heartbeatCron,
          level: agent.level ?? "specialist",
          tools: agent.tools,
        });
      } else {
        await ctx.db.insert("agents", {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: "offline",
          reportsTo: agent.reportsTo,
          sessionKey: agent.sessionKey,
          workspace: agent.workspace,
          heartbeatCron: agent.heartbeatCron,
          level: agent.level ?? "specialist",
          tools: agent.tools,
        });
      }
    }
    
    return { success: true, count: args.agents.length };
  },
});
