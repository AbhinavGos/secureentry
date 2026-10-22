import JSZip from "jszip";
import QRCode from "qrcode";

export interface AttendeeExportItem {
  ticketCode: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNumber?: string;
  designation?: string;
  organization?: string;
  category: string;
  referrerName?: string;
  referrerEmail?: string;
  rsvpStatus: string;
}

/**
 * Utility to pause for garbage collection between canvas rendering batches.
 */
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Trigger browser file download from Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || !document) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Builds Mode 1 Flat Zip archive.
 */
export async function buildAllAttendeesZip(
  attendees: AttendeeExportItem[],
  baseUrl?: string,
  onProgress?: (percent: number) => void
): Promise<JSZip> {
  const origin =
    baseUrl ||
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://event.wiserstack.com");

  const zip = new JSZip();
  const qrFolder = zip.folder("qrcodes");

  const total = attendees.length;
  const BATCH_SIZE = 20;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = attendees.slice(i, i + BATCH_SIZE);

    await Promise.all(
      chunk.map(async (att) => {
        // Encode strictly the raw ticketCode token
        const dataUrl = await QRCode.toDataURL(att.ticketCode, {
          width: 400,
          margin: 2,
          color: { dark: "#000000", light: "#FFFFFF" },
        });

        const base64Data = dataUrl.split(",")[1];
        const filename = `${att.category}_${att.firstName}_${att.lastName}_${att.ticketCode}.png`.replace(
          /\s+/g,
          "_"
        );
        qrFolder?.file(filename, base64Data, { base64: true });
      })
    );

    if (onProgress && total > 0) {
      onProgress(Math.round(((i + chunk.length) / total) * 90));
    }

    await pause(10);
  }

  // Add master index CSV
  const headers = [
    "Ticket Code",
    "First Name",
    "Last Name",
    "Email",
    "Contact",
    "Category",
    "Relationship Manager",
    "Public Pass URL",
  ];
  const rows = attendees.map((a) => [
    a.ticketCode,
    `"${a.firstName}"`,
    `"${a.lastName}"`,
    a.email,
    a.contactNumber || "",
    a.category,
    `"${a.referrerName || "Direct"}"`,
    `${origin}/t/${a.ticketCode}`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  zip.file("attendees_master_index.csv", csvContent);

  return zip;
}

/**
 * Mode 1: Flat archive containing raw-token QR images for all attendees and master CSV index.
 */
export async function exportAllAttendeesZip(
  attendees: AttendeeExportItem[],
  eventSlug: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = await buildAllAttendeesZip(attendees, undefined, onProgress);
  const zipBlob = await zip.generateAsync({ type: "blob" });
  if (onProgress) onProgress(100);
  downloadBlob(zipBlob, `${eventSlug}_all_attendees_qr_bundle.zip`);
}

/**
 * Builds Mode 2 Hierarchical RM Sub-Packs Zip archive.
 */
export async function buildRMSubPacksZip(
  attendees: AttendeeExportItem[],
  eventTitle: string,
  baseUrl?: string,
  onProgress?: (percent: number) => void
): Promise<JSZip> {
  const origin =
    baseUrl ||
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://event.wiserstack.com");

  const zip = new JSZip();
  const rmPacksFolder = zip.folder("RM_Packs");

  // Group by Relationship Manager
  const rmMap = new Map<string, AttendeeExportItem[]>();
  for (const a of attendees) {
    const rmName = (a.referrerName?.trim() || "Direct_Organic").replace(/[^a-zA-Z0-9_-]/g, "_");
    const list = rmMap.get(rmName) ?? [];
    list.push(a);
    rmMap.set(rmName, list);
  }

  const rmEntries = Array.from(rmMap.entries());
  let processed = 0;
  const total = attendees.length;

  for (const [rmName, rmGuests] of rmEntries) {
    const currentRmFolder = rmPacksFolder?.folder(rmName);
    const rmQrFolder = currentRmFolder?.folder("qrcodes");

    const guestRows: string[] = [
      "Client Name,Designation,Organization,Mobile,Pass ID,Public Pass URL,RSVP Status,WhatsApp Invite Snippet",
    ];

    for (const guest of rmGuests) {
      const dataUrl = await QRCode.toDataURL(guest.ticketCode, {
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      const base64Data = dataUrl.split(",")[1];
      const filename = `${guest.firstName}_${guest.lastName}_${guest.ticketCode}.png`.replace(
        /\s+/g,
        "_"
      );
      rmQrFolder?.file(filename, base64Data, { base64: true });

      const passUrl = `${origin}/t/${guest.ticketCode}`;
      const whatsappSnippet = `"Dear ${guest.firstName}, you are cordially invited to ${eventTitle}. View your pass and confirm your RSVP here: ${passUrl}. We look forward to hosting you."`;

      guestRows.push(
        [
          `"${guest.firstName} ${guest.lastName}"`,
          `"${guest.designation || ""}"`,
          `"${guest.organization || ""}"`,
          guest.contactNumber || "",
          guest.ticketCode,
          passUrl,
          guest.rsvpStatus,
          whatsappSnippet,
        ].join(",")
      );

      processed++;
      if (onProgress && total > 0) {
        onProgress(Math.round((processed / total) * 90));
      }
    }

    currentRmFolder?.file("RM_Guest_List.csv", guestRows.join("\n"));
    await pause(10);
  }

  return zip;
}

/**
 * Mode 2: Hierarchical archive partitioned by Relationship Manager.
 * Each RM folder contains individual QR PNGs and an RM_Guest_List.csv with pre-formatted WhatsApp snippets.
 */
export async function exportRMSubPacksZip(
  attendees: AttendeeExportItem[],
  eventSlug: string,
  eventTitle: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = await buildRMSubPacksZip(attendees, eventTitle, undefined, onProgress);
  const zipBlob = await zip.generateAsync({ type: "blob" });
  if (onProgress) onProgress(100);
  downloadBlob(zipBlob, `${eventSlug}_RM_WhatsApp_Packs.zip`);
}
