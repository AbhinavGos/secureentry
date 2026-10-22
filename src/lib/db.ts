import Dexie, { Table } from "dexie";

/**
 * Minimal sanitized attendee record stored locally on gate volunteer devices.
 * Contains ZERO PII (no personal names, phone numbers, emails, or company designations).
 */
export interface LocalAttendee {
  ticketCode: string;             // Primary indexed lookup key (raw scanned token)
  attendeeId: string;             // Convex Document ID
  category: "SPONSOR" | "VISITOR" | "VIP" | "ORGANIZER";
  allowedSessionIds?: string[];   // Multi-session access control
  checkedInSessionIds: string[];  // Tracks session admission offline
  checkInStatus: "REGISTERED" | "CHECKED_IN";
}

export interface QueuedCheckIn {
  localId?: number;               // Auto-increment primary key
  eventId: string;
  sessionId: string;
  attendeeId: string;
  ticketCode: string;
  gateId: string;
  operatorId: string;
  operatorName: string;
  clientCapturedAt: number;
  source: "SCANNER_HID" | "CAMERA" | "MANUAL";
  syncStatus: "PENDING" | "SYNCING" | "FAILED";
}

export class GateLocalDatabase extends Dexie {
  attendees!: Table<LocalAttendee, string>;
  checkInQueue!: Table<QueuedCheckIn, number>;

  constructor() {
    super("GateLocalDatabase");
    this.version(2).stores({
      attendees: "ticketCode, attendeeId, category",
      checkInQueue: "++localId, ticketCode, clientCapturedAt, syncStatus, attendeeId",
    });
  }
}

export const localDb = new GateLocalDatabase();

/**
 * Wipes the local database clean upon shift logout or event conclusion.
 */
export async function purgeLocalDatabase(): Promise<void> {
  await localDb.attendees.clear();
  await localDb.checkInQueue.clear();
}
