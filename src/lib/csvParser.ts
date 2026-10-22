export interface RawAttendeeRow {
  [key: string]: string | undefined;
}

export interface NormalizedAttendee {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber?: string;
  designation?: string;
  organization?: string;
  comments?: string;
  category: "SPONSOR" | "VISITOR" | "VIP" | "ORGANIZER";
  referrerName?: string;
  referrerEmail?: string;
  groupCode?: string;
}

/**
 * Normalizes phone numbers (especially Indian formats like 9876543210, 09876543210, 919876543210 -> +919876543210).
 */
export function normalizePhoneNumber(rawPhone?: string): string | undefined {
  if (!rawPhone) return undefined;
  const trimmed = rawPhone.trim();
  if (!trimmed) return undefined;

  // Remove whitespace, dashes, parens
  let cleaned = trimmed.replace(/[\s\-()]/g, "");
  if (!cleaned) return undefined;

  // 10 digits: add +91
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  // 11 digits starting with 0: replace 0 with +91
  if (/^0\d{10}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }
  // 12 digits starting with 91 without plus: add +
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return cleaned;
}

/**
 * Maps raw CSV row with arbitrary alias columns to normalized attendee record.
 */
export function mapCsvRowToAttendee(row: RawAttendeeRow): NormalizedAttendee {
  const firstName =
    row["First Name"] || row["firstName"] || row["Given Name"] || "Guest";
  const lastName =
    row["Last Name"] || row["lastName"] || row["Surname"] || "";
  const email =
    row["Email"] || row["email"] || row["Email ID"] || "guest@event.com";

  const rawContact =
    row["Contact Number"] ||
    row["Phone"] ||
    row["Mobile"] ||
    row["contactNumber"] ||
    row["Mobile Number"];
  const contactNumber = normalizePhoneNumber(rawContact);

  const designation =
    row["Designation"] || row["Title"] || row["Role"] || row["designation"];
  const organization =
    row["Organization"] || row["Company"] || row["organization"];
  const comments = row["Comments"] || row["Notes"] || row["comments"];

  const rawCat = (row["Category"] || row["category"] || "VISITOR").toUpperCase();
  const category: "SPONSOR" | "VISITOR" | "VIP" | "ORGANIZER" = [
    "SPONSOR",
    "VISITOR",
    "VIP",
    "ORGANIZER",
  ].includes(rawCat)
    ? (rawCat as "SPONSOR" | "VISITOR" | "VIP" | "ORGANIZER")
    : "VISITOR";

  const referrerName =
    row["Referrer Name"] ||
    row["Relationship Manager"] ||
    row["RM Name"] ||
    row["referrerName"];
  const referrerEmail =
    row["Referrer Email"] || row["RM Email"] || row["referrerEmail"];
  const groupCode = row["Group Code"] || row["groupCode"];

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    contactNumber,
    designation: designation?.trim(),
    organization: organization?.trim(),
    comments: comments?.trim(),
    category,
    referrerName: referrerName?.trim(),
    referrerEmail: referrerEmail?.trim().toLowerCase(),
    groupCode: groupCode?.trim(),
  };
}
