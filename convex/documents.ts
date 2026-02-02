import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const getAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("documents")
      .order("desc")
      .take(limit);
  },
});

export const getById = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByTask = query({
  args: { taskId: v.id("tasks"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("documents")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .take(limit);
  },
});

export const getByAuthor = query({
  args: { authorId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("documents")
      .withIndex("by_author", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .take(limit);
  },
});

export const getByStatus = query({
  args: { 
    status: v.union(v.literal("draft"), v.literal("in_review"), v.literal("approved"), v.literal("archived")),
    limit: v.optional(v.number()) 
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(limit);
  },
});

// Mutations
export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    contentType: v.optional(v.union(v.literal("markdown"), v.literal("text"), v.literal("json"))),
    authorId: v.string(),
    taskId: v.optional(v.id("tasks")),
    status: v.optional(v.union(v.literal("draft"), v.literal("in_review"), v.literal("approved"), v.literal("archived"))),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      contentType: args.contentType ?? "markdown",
      authorId: args.authorId,
      taskId: args.taskId,
      status: args.status ?? "draft",
      version: 1,
      tags: args.tags,
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      actorId: args.authorId,
      actorType: "agent",
      action: "created_document",
      targetType: "document",
      targetId: documentId,
      metadata: { title: args.title },
    });
    
    return documentId;
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    updatedBy: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("in_review"), v.literal("approved"), v.literal("archived"))),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, updatedBy, ...updates } = args;
    const doc = await ctx.db.get(id);
    
    if (!doc) {
      throw new Error("Document not found");
    }
    
    const updateData: Partial<typeof doc> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    
    updateData.version = doc.version + 1;
    
    await ctx.db.patch(id, updateData);
    const document = await ctx.db.get(id);
    
    // Log activity
    await ctx.db.insert("activities", {
      actorId: updatedBy,
      actorType: "agent",
      action: "updated_document",
      targetType: "document",
      targetId: id,
      metadata: { title: updates.title ?? doc.title },
    });
    
    return document;
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
