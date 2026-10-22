import { describe, it, expect } from "vitest";
import { normalizePhoneNumber, mapCsvRowToAttendee } from "../../src/lib/csvParser";

describe("CSV Import & Normalization", () => {
  describe("normalizePhoneNumber", () => {
    it("should normalize standard 10-digit Indian phone numbers to +91", () => {
      expect(normalizePhoneNumber("9876543210")).toBe("+919876543210");
    });

    it("should handle 11-digit numbers with leading 0", () => {
      expect(normalizePhoneNumber("09876543210")).toBe("+919876543210");
    });

    it("should prepend + to 12-digit numbers starting with 91", () => {
      expect(normalizePhoneNumber("919876543210")).toBe("+919876543210");
    });

    it("should preserve valid E.164 numbers with existing +", () => {
      expect(normalizePhoneNumber("+919876543210")).toBe("+919876543210");
      expect(normalizePhoneNumber("+14155552671")).toBe("+14155552671");
    });

    it("should strip dashes, spaces, and brackets cleanly", () => {
      expect(normalizePhoneNumber("+91 (987) 654-3210")).toBe("+919876543210");
      expect(normalizePhoneNumber("98765 43210")).toBe("+919876543210");
    });

    it("should return undefined for empty or invalid values", () => {
      expect(normalizePhoneNumber(undefined)).toBeUndefined();
      expect(normalizePhoneNumber("")).toBeUndefined();
      expect(normalizePhoneNumber("   ")).toBeUndefined();
    });
  });

  describe("mapCsvRowToAttendee", () => {
    it("should map standard column headers accurately", () => {
      const row = {
        "First Name": "Aarav",
        "Last Name": "Sharma",
        Email: "aarav@example.com",
        "Contact Number": "9876543210",
        Designation: "Director",
        Organization: "Apex Capital",
        Category: "VIP",
        "Relationship Manager": "Priya Singh",
        "RM Email": "priya@wiserstack.com",
      };

      const result = mapCsvRowToAttendee(row);
      expect(result.firstName).toBe("Aarav");
      expect(result.lastName).toBe("Sharma");
      expect(result.email).toBe("aarav@example.com");
      expect(result.contactNumber).toBe("+919876543210");
      expect(result.designation).toBe("Director");
      expect(result.organization).toBe("Apex Capital");
      expect(result.category).toBe("VIP");
      expect(result.referrerName).toBe("Priya Singh");
      expect(result.referrerEmail).toBe("priya@wiserstack.com");
    });

    it("should support alternate alias headers", () => {
      const row = {
        firstName: "Rohan",
        Surname: "Verma",
        "Email ID": "ROHAN@ACME.ORG",
        Mobile: "09123456789",
        Role: "VP Engineering",
        Company: "Acme Tech",
        category: "sponsor",
        "RM Name": "Rahul Kapoor",
      };

      const result = mapCsvRowToAttendee(row);
      expect(result.firstName).toBe("Rohan");
      expect(result.lastName).toBe("Verma");
      expect(result.email).toBe("rohan@acme.org");
      expect(result.contactNumber).toBe("+919123456789");
      expect(result.designation).toBe("VP Engineering");
      expect(result.organization).toBe("Acme Tech");
      expect(result.category).toBe("SPONSOR");
      expect(result.referrerName).toBe("Rahul Kapoor");
    });

    it("should default category to VISITOR if unknown or missing", () => {
      const row = {
        "First Name": "Sunita",
        "Last Name": "Patel",
        Email: "sunita@domain.com",
        Category: "UNKNOWN_SPECIAL",
      };

      const result = mapCsvRowToAttendee(row);
      expect(result.category).toBe("VISITOR");
    });
  });
});
