import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  events: defineTable({
    title: v.string(),
    slug: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    location: v.string(),
    venueName: v.string(),
    venueAddress: v.optional(v.string()),
    gatePasscode: v.string(), // Passcode for gate operator shift access
    gates: v.optional(v.array(v.string())), // Predefined gate names (e.g. ["Gate 1", "VIP Gate"])
    maskAttendeeDetailsAtGate: v.boolean(), // Gate privacy sanitization flag
    active: v.boolean(),
  }).index("by_slug", ["slug"]),

  // Renamed from 'sessions' to 'eventSessions' to prevent collision with Convex Auth internal tables
  eventSessions: defineTable({
    eventId: v.id("events"),
    title: v.string(),
    location: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    capacity: v.optional(v.number()), // Pre-allocated badge limit or room quota
    isPrimary: v.boolean(),
  }).index("by_event", ["eventId"]),

  attendees: defineTable({
    eventId: v.id("events"),
    ticketCode: v.string(), // Cryptographically random 12-char nanoid (encoded in QR code)
    ticketStatus: v.union(v.literal("ACTIVE"), v.literal("REVOKED"), v.literal("EXPIRED")),
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
    groupCode: v.optional(v.string()), // Groups delegations / spouses for 1-tap admission
    parentAttendeeId: v.optional(v.id("attendees")),
    rsvpStatus: v.union(
      v.literal("YES"),
      v.literal("NO"),
      v.literal("MAYBE"),
      v.literal("PENDING")
    ),
    allowedSessionIds: v.optional(v.array(v.id("eventSessions"))),
    checkInStatus: v.union(v.literal("REGISTERED"), v.literal("CHECKED_IN")),
    firstSeenAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    checkInMethod: v.optional(v.union(v.literal("QR_SCAN"), v.literal("MANUAL"))),
    customData: v.optional(v.any()),
  })
    .index("by_event_ticket", ["eventId", "ticketCode"])
    .index("by_event_email", ["eventId", "email"])
    .index("by_event_category", ["eventId", "category"])
    .index("by_event_referrer", ["eventId", "referrerEmail"])
    .index("by_event_group", ["eventId", "groupCode"])
    .searchIndex("search_roster", {
      searchField: "lastName",
      filterFields: ["eventId", "organization", "category", "referrerEmail"],
    }),

  checkIns: defineTable({
    eventId: v.id("events"),
    sessionId: v.id("eventSessions"),
    attendeeId: v.id("attendees"),
    gateId: v.string(),
    operatorId: v.string(),
    operatorName: v.string(),
    clientCapturedAt: v.number(), // Client device timestamp
    serverSyncedAt: v.number(),   // Authoritative Convex server timestamp
    source: v.union(v.literal("SCANNER_HID"), v.literal("CAMERA"), v.literal("MANUAL")),
    isOfflineSync: v.boolean(),
    isCollision: v.boolean(),     // True if committed from offline queue but was a duplicate
  })
    .index("by_session_attendee", ["sessionId", "attendeeId"]) // Prevents duplicate check-in
    .index("by_event_session", ["eventId", "sessionId"])
    .index("by_event_timestamp", ["eventId", "serverSyncedAt"])
    .index("by_attendee", ["attendeeId"]),

  messageTemplates: defineTable({
    eventId: v.id("events"),
    channel: v.union(v.literal("EMAIL"), v.literal("SMS")),
    subject: v.optional(v.string()),
    templateBody: v.string(),
    senderId: v.optional(v.string()),
  }).index("by_event_channel", ["eventId", "channel"]),

  deliveryLogs: defineTable({
    eventId: v.id("events"),
    attendeeId: v.id("attendees"),
    channel: v.string(),
    externalMessageId: v.optional(v.string()),
    status: v.union(
      v.literal("QUEUED"),
      v.literal("SENT"),
      v.literal("DELIVERED"),
      v.literal("READ"),
      v.literal("FAILED"),
      v.literal("BOUNCED")
    ),
    errorReason: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_event_status", ["eventId", "status"])
    .index("by_attendee", ["attendeeId"]),
});
