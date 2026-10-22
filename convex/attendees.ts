import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nanoid } from "nanoid";

/**
 * Sanitized gate roster projection for offline caching on volunteer devices.
 * Contains ZERO personal names, emails, phone numbers, or corporate designations.
 */
export const getSanitizedGateRoster = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const attendees = await ctx.db
      .query("attendees")
      .withIndex("by_event_ticket", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("ticketStatus"), "ACTIVE"))
      .collect();

    // Map existing checkIns for this event to populate checkedInSessionIds
    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_event_session", (q) => q.eq("eventId", args.eventId))
      .collect();

    const checkedInMap = new Map<string, string[]>();
    for (const c of checkIns) {
      const existing = checkedInMap.get(c.attendeeId) ?? [];
      existing.push(c.sessionId);
      checkedInMap.set(c.attendeeId, existing);
    }

    return attendees.map((a) => ({
      ticketCode: a.ticketCode,
      attendeeId: a._id,
      category: a.category,
      allowedSessionIds: a.allowedSessionIds,
      checkedInSessionIds: checkedInMap.get(a._id) ?? [],
      checkInStatus: a.checkInStatus,
    }));
  },
});

/**
 * Safe public ticket query for /t/:ticketCode.
 * Returns only non-sensitive event details and masked attendee name.
 */
export const getPublicTicket = query({
  args: { ticketCode: v.string() },
  handler: async (ctx, args) => {
    const attendee = await ctx.db
      .query("attendees")
      .filter((q) => q.eq(q.field("ticketCode"), args.ticketCode))
      .first();

    if (!attendee || attendee.ticketStatus !== "ACTIVE") {
      return null;
    }

    const event = await ctx.db.get(attendee.eventId);
    if (!event) return null;

    // Mask last name (e.g. Goswami -> G******)
    const lastNameMasked =
      attendee.lastName.length > 2
        ? attendee.lastName[0] + "*".repeat(attendee.lastName.length - 1)
        : attendee.lastName;

    return {
      attendee: {
        firstName: attendee.firstName,
        lastNameMasked,
        category: attendee.category,
        rsvpStatus: attendee.rsvpStatus,
        ticketCode: attendee.ticketCode, // Raw token for rendering pass QR
      },
      event: {
        title: event.title,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        startDate: event.startDate,
        endDate: event.endDate,
      },
    };
  },
});

/**
 * Public 3-way RSVP confirmation.
 */
export const confirmRsvp = mutation({
  args: {
    ticketCode: v.string(),
    response: v.union(v.literal("YES"), v.literal("NO"), v.literal("MAYBE")),
  },
  handler: async (ctx, args) => {
    const attendee = await ctx.db
      .query("attendees")
      .filter((q) => q.eq(q.field("ticketCode"), args.ticketCode))
      .first();

    if (!attendee) {
      throw new Error("Invalid ticket code.");
    }

    await ctx.db.patch(attendee._id, {
      rsvpStatus: args.response,
    });

    return { success: true };
  },
});

/**
 * Full roster query for authenticated admin dashboard.
 */
export const getRoster = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attendees")
      .withIndex("by_event_ticket", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

/**
 * Relationship Manager conversion breakdown for admin dashboard.
 */
export const getRMStats = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const attendees = await ctx.db
      .query("attendees")
      .withIndex("by_event_referrer", (q) => q.eq("eventId", args.eventId))
      .collect();

    const rmMap = new Map<
      string,
      {
        referrerName: string;
        referrerEmail: string;
        totalAssigned: number;
        confirmedYes: number;
        maybe: number;
        declinedNo: number;
        pending: number;
        checkedIn: number;
      }
    >();

    for (const a of attendees) {
      const email = a.referrerEmail || "direct_organic";
      const name = a.referrerName || "Direct / Organic";

      const current = rmMap.get(email) ?? {
        referrerName: name,
        referrerEmail: email,
        totalAssigned: 0,
        confirmedYes: 0,
        maybe: 0,
        declinedNo: 0,
        pending: 0,
        checkedIn: 0,
      };

      current.totalAssigned += 1;
      if (a.rsvpStatus === "YES") current.confirmedYes += 1;
      else if (a.rsvpStatus === "MAYBE") current.maybe += 1;
      else if (a.rsvpStatus === "NO") current.declinedNo += 1;
      else current.pending += 1;

      if (a.checkInStatus === "CHECKED_IN") current.checkedIn += 1;

      rmMap.set(email, current);
    }

    return Array.from(rmMap.values());
  },
});

/**
 * Bulk CSV attendee import with auto-generated 12-char nanoid tokens.
 */
export const batchImportAttendees = mutation({
  args: {
    eventId: v.id("events"),
    attendees: v.array(
      v.object({
        firstName: v.string(),
        lastName: v.string(),
        email: v.string(),
        contactNumber: v.optional(v.string()),
        designation: v.optional(v.string()),
        organization: v.optional(v.string()),
        comments: v.optional(v.string()),
        category: v.union(
          v.literal("SPONSOR"),
          v.literal("VISITOR"),
          v.literal("VIP"),
          v.literal("ORGANIZER")
        ),
        referrerName: v.optional(v.string()),
        referrerEmail: v.optional(v.string()),
        groupCode: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let imported = 0;
    for (const item of args.attendees) {
      const ticketCode = nanoid(12);
      await ctx.db.insert("attendees", {
        eventId: args.eventId,
        ticketCode,
        ticketStatus: "ACTIVE",
        firstName: item.firstName.trim(),
        lastName: item.lastName.trim(),
        email: item.email.trim().toLowerCase(),
        contactNumber: item.contactNumber?.trim(),
        designation: item.designation?.trim(),
        organization: item.organization?.trim(),
        comments: item.comments?.trim(),
        category: item.category,
        referrerName: item.referrerName?.trim(),
        referrerEmail: item.referrerEmail?.trim().toLowerCase(),
        groupCode: item.groupCode?.trim(),
        rsvpStatus: "PENDING",
        checkInStatus: "REGISTERED",
      });
      imported += 1;
    }
    return { count: imported };
  },
});

/**
 * Search attendee directory (by name or phone number).
 */
export const searchAttendees = query({
  args: {
    eventId: v.id("events"),
    queryString: v.string(),
  },
  handler: async (ctx, args) => {
    const term = args.queryString.trim().toLowerCase();
    if (!term) return [];

    const all = await ctx.db
      .query("attendees")
      .withIndex("by_event_ticket", (q) => q.eq("eventId", args.eventId))
      .collect();

    return all
      .filter((a) => {
        const full = `${a.firstName} ${a.lastName}`.toLowerCase();
        const phone = a.contactNumber?.toLowerCase() ?? "";
        const email = a.email.toLowerCase();
        const code = a.ticketCode.toLowerCase();
        return (
          full.includes(term) ||
          phone.includes(term) ||
          email.includes(term) ||
          code.includes(term)
        );
      })
      .slice(0, 10);
  },
});

/**
 * Reissue a compromised ticket code.
 */
export const reissueTicketCode = mutation({
  args: { attendeeId: v.id("attendees") },
  handler: async (ctx, args) => {
    const attendee = await ctx.db.get(args.attendeeId);
    if (!attendee) throw new Error("Attendee not found");

    const newTicketCode = nanoid(12);
    await ctx.db.patch(args.attendeeId, {
      ticketCode: newTicketCode,
      ticketStatus: "ACTIVE",
    });

    return { newTicketCode };
  },
});

/**
 * Manually add a single attendee with auto-generated nanoid token.
 */
export const createAttendee = mutation({
  args: {
    eventId: v.id("events"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    contactNumber: v.optional(v.string()),
    designation: v.optional(v.string()),
    organization: v.optional(v.string()),
    category: v.union(
      v.literal("SPONSOR"),
      v.literal("VISITOR"),
      v.literal("VIP"),
      v.literal("ORGANIZER")
    ),
    referrerName: v.optional(v.string()),
    referrerEmail: v.optional(v.string()),
    groupCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticketCode = nanoid(12);
    const attendeeId = await ctx.db.insert("attendees", {
      eventId: args.eventId,
      ticketCode,
      ticketStatus: "ACTIVE",
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email: args.email.trim().toLowerCase(),
      contactNumber: args.contactNumber?.trim(),
      designation: args.designation?.trim(),
      organization: args.organization?.trim(),
      category: args.category,
      referrerName: args.referrerName?.trim(),
      referrerEmail: args.referrerEmail?.trim().toLowerCase(),
      groupCode: args.groupCode?.trim(),
      rsvpStatus: "PENDING",
      checkInStatus: "REGISTERED",
    });

    return { attendeeId, ticketCode };
  },
});

