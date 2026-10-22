import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const recordCheckIn = mutation({
  args: {
    eventId: v.id("events"),
    sessionId: v.id("eventSessions"),
    ticketCode: v.string(),
    gateId: v.string(),
    operatorId: v.string(),
    operatorName: v.string(),
    clientCapturedAt: v.number(),
    source: v.union(v.literal("SCANNER_HID"), v.literal("CAMERA"), v.literal("MANUAL")),
    isOfflineSync: v.boolean(),
  },
  handler: async (ctx, args) => {
    // 1. Verify event and session
    const event = await ctx.db.get(args.eventId);
    if (!event || !event.active) {
      throw new Error("Event is not active or does not exist.");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session does not exist.");
    }

    // 2. Look up attendee by ticketCode
    const attendee = await ctx.db
      .query("attendees")
      .withIndex("by_event_ticket", (q) =>
        q.eq("eventId", args.eventId).eq("ticketCode", args.ticketCode)
      )
      .first();

    if (!attendee) {
      throw new Error("INVALID_TICKET: Pass not recognized.");
    }

    if (attendee.ticketStatus !== "ACTIVE") {
      throw new Error("REVOKED_TICKET: Pass is no longer valid.");
    }

    // 3. Verify session permission if restricted
    if (
      attendee.allowedSessionIds &&
      attendee.allowedSessionIds.length > 0 &&
      !attendee.allowedSessionIds.includes(args.sessionId)
    ) {
      throw new Error("SESSION_RESTRICTED: Pass not valid for this room.");
    }

    const now = Date.now();

    // 4. Check compound uniqueness on [sessionId, attendeeId]
    const existingCheckIn = await ctx.db
      .query("checkIns")
      .withIndex("by_session_attendee", (q) =>
        q.eq("sessionId", args.sessionId).eq("attendeeId", attendee._id)
      )
      .first();

    if (existingCheckIn) {
      if (!args.isOfflineSync) {
        // Online duplicate: reject immediately
        throw new Error(
          `ALREADY_CHECKED_IN: Scanned at ${existingCheckIn.gateId} by ${existingCheckIn.operatorName} at ${new Date(
            existingCheckIn.serverSyncedAt
          ).toLocaleTimeString()}`
        );
      } else {
        // Replayed from offline queue: commit as a collision for administrative audit
        await ctx.db.insert("checkIns", {
          eventId: args.eventId,
          sessionId: args.sessionId,
          attendeeId: attendee._id,
          gateId: args.gateId,
          operatorId: args.operatorId,
          operatorName: args.operatorName,
          clientCapturedAt: args.clientCapturedAt,
          serverSyncedAt: now,
          source: args.source,
          isOfflineSync: true,
          isCollision: true,
        });

        return {
          status: "COLLISION",
          attendeeId: attendee._id,
          category: attendee.category,
        };
      }
    }

    // 5. Insert new check-in record
    await ctx.db.insert("checkIns", {
      eventId: args.eventId,
      sessionId: args.sessionId,
      attendeeId: attendee._id,
      gateId: args.gateId,
      operatorId: args.operatorId,
      operatorName: args.operatorName,
      clientCapturedAt: args.clientCapturedAt,
      serverSyncedAt: now,
      source: args.source,
      isOfflineSync: args.isOfflineSync,
      isCollision: false,
    });

    // 6. Update attendee document
    await ctx.db.patch(attendee._id, {
      checkInStatus: "CHECKED_IN",
      lastSeenAt: now,
      firstSeenAt: attendee.firstSeenAt ?? now,
      checkInMethod: args.source === "MANUAL" ? "MANUAL" : "QR_SCAN",
    });

    return {
      status: "ADMITTED",
      attendeeId: attendee._id,
      category: attendee.category,
    };
  },
});

export const getLiveStats = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const attendees = await ctx.db
      .query("attendees")
      .withIndex("by_event_ticket", (q) => q.eq("eventId", args.eventId))
      .collect();

    const totalRegistered = attendees.length;
    let checkedInCount = 0;
    let rsvpYes = 0;
    let rsvpMaybe = 0;
    let rsvpNo = 0;
    let rsvpPending = 0;

    for (const a of attendees) {
      if (a.checkInStatus === "CHECKED_IN") checkedInCount++;
      if (a.rsvpStatus === "YES") rsvpYes++;
      else if (a.rsvpStatus === "MAYBE") rsvpMaybe++;
      else if (a.rsvpStatus === "NO") rsvpNo++;
      else rsvpPending++;
    }

    // Velocity in the last 15 minutes
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    const recentCheckIns = await ctx.db
      .query("checkIns")
      .withIndex("by_event_timestamp", (q) =>
        q.eq("eventId", args.eventId).gte("serverSyncedAt", fifteenMinutesAgo)
      )
      .collect();

    return {
      totalRegistered,
      checkedInCount,
      checkedInPercent: totalRegistered > 0 ? Math.round((checkedInCount / totalRegistered) * 100) : 0,
      rsvp: {
        yes: rsvpYes,
        maybe: rsvpMaybe,
        no: rsvpNo,
        pending: rsvpPending,
      },
      velocityLast15m: recentCheckIns.length,
    };
  },
});

export const getRecentCheckIns = query({
  args: {
    eventId: v.id("events"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_event_timestamp", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .take(args.limit ?? 25);

    // Enrich with masked attendee details
    const enriched = await Promise.all(
      checkIns.map(async (c) => {
        const attendee = await ctx.db.get(c.attendeeId);
        return {
          _id: c._id,
          ticketCode: attendee?.ticketCode ?? "UNKNOWN",
          category: attendee?.category ?? "VISITOR",
          gateId: c.gateId,
          operatorName: c.operatorName,
          source: c.source,
          timestamp: c.serverSyncedAt,
          isCollision: c.isCollision,
        };
      })
    );

    return enriched;
  },
});

export const getSecurityCollisions = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const collisions = await ctx.db
      .query("checkIns")
      .withIndex("by_event_session", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("isCollision"), true))
      .order("desc")
      .collect();

    return await Promise.all(
      collisions.map(async (c) => {
        const attendee = await ctx.db.get(c.attendeeId);
        return {
          _id: c._id,
          attendeeId: c.attendeeId,
          ticketCode: attendee?.ticketCode ?? "UNKNOWN",
          category: attendee?.category ?? "UNKNOWN",
          gateId: c.gateId,
          operatorName: c.operatorName,
          clientCapturedAt: c.clientCapturedAt,
          serverSyncedAt: c.serverSyncedAt,
        };
      })
    );
  },
});

export const resetCheckIn = mutation({
  args: {
    eventId: v.id("events"),
    attendeeId: v.id("attendees"),
  },
  handler: async (ctx, args) => {
    // Delete check-ins for this attendee
    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_attendee", (q) => q.eq("attendeeId", args.attendeeId))
      .collect();

    for (const c of checkIns) {
      await ctx.db.delete(c._id);
    }

    // Reset attendee status
    await ctx.db.patch(args.attendeeId, {
      checkInStatus: "REGISTERED",
      firstSeenAt: undefined,
      lastSeenAt: undefined,
      checkInMethod: undefined,
    });

    return { success: true };
  },
});
