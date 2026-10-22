import { mutation } from "./_generated/server";
import { nanoid } from "nanoid";

/**
 * Quick-start seed mutation to populate a full demo event with sample attendees,
 * gates, sessions, and RM allocations for instant testing.
 */
export const seedDemoEvent = mutation({
  handler: async (ctx) => {
    const slug = "wiserstack-conclave-2026";
    const existing = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existing) {
      return { success: true, eventId: existing._id, slug, alreadyExisted: true };
    }

    const eventId = await ctx.db.insert("events", {
      title: "WiserStack Conclave 2026",
      slug,
      startDate: Date.now(),
      endDate: Date.now() + 86400000,
      location: "Mumbai, India",
      venueName: "The St. Regis Grand Ballroom",
      venueAddress: "462, Senapati Bapat Marg, Lower Parel, Mumbai",
      gatePasscode: "1234",
      gates: ["Gate 1 (Main Entrance)", "Gate 2 (VIP Pass)", "Gate 3 (South Corridor)"],
      maskAttendeeDetailsAtGate: true,
      active: true,
    });

    await ctx.db.insert("eventSessions", {
      eventId,
      title: "Keynote & Plenary Session",
      location: "Grand Ballroom A",
      startTime: Date.now(),
      endTime: Date.now() + 14400000,
      isPrimary: true,
    });

    await ctx.db.insert("eventSessions", {
      eventId,
      title: "Executive Closed-Door Round Table",
      location: "Boardroom 3",
      startTime: Date.now() + 18000000,
      endTime: Date.now() + 25200000,
      isPrimary: false,
    });

    const sampleGuests = [
      {
        firstName: "Aarav",
        lastName: "Sharma",
        email: "aarav.sharma@example.com",
        contactNumber: "+919876543210",
        designation: "Managing Director",
        organization: "Apex Capital India",
        category: "VIP" as const,
        referrerName: "Priya Singh",
        referrerEmail: "priya@wiserstack.com",
        rsvpStatus: "YES" as const,
      },
      {
        firstName: "Ananya",
        lastName: "Deshmukh",
        email: "ananya.d@example.com",
        contactNumber: "+919123456789",
        designation: "Chief Technology Officer",
        organization: "Tata Digital",
        category: "SPONSOR" as const,
        referrerName: "Priya Singh",
        referrerEmail: "priya@wiserstack.com",
        rsvpStatus: "YES" as const,
      },
      {
        firstName: "Rohan",
        lastName: "Verma",
        email: "rohan.v@example.com",
        contactNumber: "+919988776655",
        designation: "Partner",
        organization: "Elevation Ventures",
        category: "VIP" as const,
        referrerName: "Amit Kumar",
        referrerEmail: "amit@wiserstack.com",
        rsvpStatus: "MAYBE" as const,
      },
      {
        firstName: "Sneha",
        lastName: "Iyer",
        email: "sneha.i@example.com",
        contactNumber: "+919811223344",
        designation: "VP Product",
        organization: "Paytm Payments",
        category: "VISITOR" as const,
        referrerName: "Amit Kumar",
        referrerEmail: "amit@wiserstack.com",
        rsvpStatus: "PENDING" as const,
      },
      {
        firstName: "Vikram",
        lastName: "Mehta",
        email: "vikram@mehtalabs.com",
        contactNumber: "+919700112233",
        designation: "Founder & CEO",
        organization: "Mehta Labs",
        category: "ORGANIZER" as const,
        referrerName: "Direct / Organic",
        referrerEmail: "direct@wiserstack.com",
        rsvpStatus: "YES" as const,
      },
    ];

    for (const g of sampleGuests) {
      await ctx.db.insert("attendees", {
        eventId,
        ticketCode: nanoid(12),
        ticketStatus: "ACTIVE",
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        contactNumber: g.contactNumber,
        designation: g.designation,
        organization: g.organization,
        category: g.category,
        referrerName: g.referrerName,
        referrerEmail: g.referrerEmail,
        rsvpStatus: g.rsvpStatus,
        checkInStatus: "REGISTERED",
      });
    }

    return { success: true, eventId, slug, createdCount: sampleGuests.length };
  },
});
