import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listInviters = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inviters")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const createInviter = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    designation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("inviters", {
      eventId: args.eventId,
      name: args.name.trim(),
      email: args.email.trim().toLowerCase(),
      phone: args.phone?.trim(),
      designation: args.designation?.trim(),
    });
  },
});

export const deleteInviter = mutation({
  args: { id: v.id("inviters") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
