import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getEventBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const listEvents = query({
  handler: async (ctx) => {
    return await ctx.db.query("events").collect();
  },
});

export const createEvent = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    location: v.string(),
    venueName: v.string(),
    venueAddress: v.optional(v.string()),
    gatePasscode: v.string(),
    gates: v.optional(v.array(v.string())),
    maskAttendeeDetailsAtGate: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      throw new Error(`Event with slug '${args.slug}' already exists.`);
    }

    const eventId = await ctx.db.insert("events", {
      ...args,
      gates: args.gates ?? ["Main Gate", "VIP Gate", "East Door"],
      active: true,
    });

    // Automatically create a default Primary Session for the event
    await ctx.db.insert("eventSessions", {
      eventId,
      title: "Main Conference / Primary Entry",
      location: args.venueName,
      startTime: args.startDate,
      endTime: args.endDate,
      isPrimary: true,
    });

    return eventId;
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    location: v.optional(v.string()),
    venueName: v.optional(v.string()),
    venueAddress: v.optional(v.string()),
    gatePasscode: v.optional(v.string()),
    gates: v.optional(v.array(v.string())),
    maskAttendeeDetailsAtGate: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const verifyGatePasscode = query({
  args: {
    slug: v.string(),
    passcode: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!event) {
      return { success: false, reason: "Event not found" };
    }

    if (!event.active) {
      return { success: false, reason: "Event is inactive" };
    }

    if (event.gatePasscode !== args.passcode) {
      return { success: false, reason: "Invalid passcode" };
    }

    const sessions = await ctx.db
      .query("eventSessions")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();

    return {
      success: true,
      event: {
        _id: event._id,
        title: event.title,
        slug: event.slug,
        venueName: event.venueName,
        maskAttendeeDetailsAtGate: event.maskAttendeeDetailsAtGate,
        gates: event.gates ?? ["Main Gate", "VIP Gate", "East Door"],
      },
      sessions: sessions.map((s) => ({
        _id: s._id,
        title: s.title,
        isPrimary: s.isPrimary,
      })),
      serverTime: Date.now(),
    };
  },
});
