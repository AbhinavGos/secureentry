import { describe, it, expect } from "vitest";
import {
  buildAllAttendeesZip,
  buildRMSubPacksZip,
  AttendeeExportItem,
} from "../../src/lib/exportZip";

describe("Export Zip Utilities", () => {
  const sampleAttendees: AttendeeExportItem[] = [
    {
      ticketCode: "V1StGXR8_Z5j",
      firstName: "Rohan",
      lastName: "Kapoor",
      email: "rohan@example.com",
      contactNumber: "+919876543210",
      designation: "Managing Director",
      organization: "Apex Capital",
      category: "VIP",
      referrerName: "Priya Sharma",
      referrerEmail: "priya@wiserstack.com",
      rsvpStatus: "YES",
    },
    {
      ticketCode: "ATT_8F3A29",
      firstName: "Ananya",
      lastName: "Deshmukh",
      email: "ananya@example.com",
      contactNumber: "+919123456789",
      designation: "Chief Architect",
      organization: "Tata Digital",
      category: "SPONSOR",
      referrerName: "Priya Sharma",
      referrerEmail: "priya@wiserstack.com",
      rsvpStatus: "PENDING",
    },
    {
      ticketCode: "ATT_999999",
      firstName: "Vikram",
      lastName: "Mehta",
      email: "vikram@example.com",
      contactNumber: "+919988776655",
      designation: "Founder",
      organization: "Mehta Labs",
      category: "VISITOR",
      referrerName: "Amit Kumar",
      referrerEmail: "amit@wiserstack.com",
      rsvpStatus: "NO",
    },
  ];

  describe("Mode 1: Flat Zip Archive (buildAllAttendeesZip)", () => {
    it("should bundle raw QR images and master index CSV", async () => {
      const zip = await buildAllAttendeesZip(
        sampleAttendees,
        "https://event.wiserstack.com"
      );

      // Verify master index CSV exists
      const masterCsv = zip.file("attendees_master_index.csv");
      expect(masterCsv).not.toBeNull();

      const csvContent = await masterCsv!.async("string");
      expect(csvContent).toContain("Ticket Code,First Name,Last Name,Email");
      expect(csvContent).toContain("V1StGXR8_Z5j,\"Rohan\",\"Kapoor\",rohan@example.com");
      expect(csvContent).toContain("https://event.wiserstack.com/t/V1StGXR8_Z5j");

      // Verify QR files exist in qrcodes folder
      const qrFiles = zip.folder("qrcodes");
      expect(qrFiles).not.toBeNull();

      const rohanFile = zip.file("qrcodes/VIP_Rohan_Kapoor_V1StGXR8_Z5j.png");
      expect(rohanFile).not.toBeNull();

      const ananyaFile = zip.file("qrcodes/SPONSOR_Ananya_Deshmukh_ATT_8F3A29.png");
      expect(ananyaFile).not.toBeNull();
    });
  });

  describe("Mode 2: Hierarchical RM Sub-Packs (buildRMSubPacksZip)", () => {
    it("should partition attendees by Relationship Manager with personalized snippets", async () => {
      const zip = await buildRMSubPacksZip(
        sampleAttendees,
        "WiserStack Tech Summit 2026",
        "https://event.wiserstack.com"
      );

      // Verify Priya Sharma's pack
      const priyaCsv = zip.file("RM_Packs/Priya_Sharma/RM_Guest_List.csv");
      expect(priyaCsv).not.toBeNull();

      const priyaCsvContent = await priyaCsv!.async("string");
      expect(priyaCsvContent).toContain("Client Name,Designation,Organization,Mobile,Pass ID,Public Pass URL,RSVP Status,WhatsApp Invite Snippet");
      expect(priyaCsvContent).toContain("\"Rohan Kapoor\",\"Managing Director\",\"Apex Capital\",+919876543210,V1StGXR8_Z5j,https://event.wiserstack.com/t/V1StGXR8_Z5j,YES");
      expect(priyaCsvContent).toContain("Dear Rohan, you are cordially invited to WiserStack Tech Summit 2026");

      // Verify Priya's guest QR codes are present
      expect(zip.file("RM_Packs/Priya_Sharma/qrcodes/Rohan_Kapoor_V1StGXR8_Z5j.png")).not.toBeNull();
      expect(zip.file("RM_Packs/Priya_Sharma/qrcodes/Ananya_Deshmukh_ATT_8F3A29.png")).not.toBeNull();

      // Verify Amit Kumar's pack
      const amitCsv = zip.file("RM_Packs/Amit_Kumar/RM_Guest_List.csv");
      expect(amitCsv).not.toBeNull();
      expect(zip.file("RM_Packs/Amit_Kumar/qrcodes/Vikram_Mehta_ATT_999999.png")).not.toBeNull();
    });
  });
});
