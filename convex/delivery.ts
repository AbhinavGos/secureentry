import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getAttendeesForDispatch = internalQuery({
  args: {
    eventId: v.id("events"),
    recipientCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let attendees = await ctx.db
      .query("attendees")
      .withIndex("by_event_ticket", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("ticketStatus"), "ACTIVE"))
      .collect();

    if (args.recipientCategory && args.recipientCategory !== "ALL") {
      if (args.recipientCategory === "UNCONFIRMED") {
        attendees = attendees.filter((a) => a.rsvpStatus === "PENDING");
      } else {
        attendees = attendees.filter((a) => a.category === args.recipientCategory);
      }
    }

    const event = await ctx.db.get(args.eventId);

    return { attendees, event };
  },
});

export const recordDeliveryLog = internalMutation({
  args: {
    eventId: v.id("events"),
    attendeeId: v.id("attendees"),
    status: v.union(
      v.literal("QUEUED"),
      v.literal("SENT"),
      v.literal("DELIVERED"),
      v.literal("READ"),
      v.literal("FAILED"),
      v.literal("BOUNCED")
    ),
    externalMessageId: v.optional(v.string()),
    errorReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("deliveryLogs", {
      eventId: args.eventId,
      attendeeId: args.attendeeId,
      channel: "EMAIL",
      externalMessageId: args.externalMessageId,
      status: args.status,
      errorReason: args.errorReason,
      timestamp: Date.now(),
    });
  },
});
