import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listSessionsByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("eventSessions")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const createSession = mutation({
  args: {
    eventId: v.id("events"),
    title: v.string(),
    location: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    capacity: v.optional(v.number()),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("eventSessions", args);
  },
});

export const updateSession = mutation({
  args: {
    id: v.id("eventSessions"),
    title: v.optional(v.string()),
    location: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    capacity: v.optional(v.number()),
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteSession = mutation({
  args: { id: v.id("eventSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) return;
    if (session.isPrimary) {
      throw new Error("Cannot delete primary session.");
    }
    await ctx.db.delete(args.id);
  },
});
