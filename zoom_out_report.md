# Goldfish Review Report: Zoom-Out Architecture Audit

**Target:** `docs/designs/real-time-event-check-in-system.md` (`1-814`)  
**Reviewer Lens:** `egm-zoom-out`  
**Standard Reference:** `resources/document_standards/zoom-out-standard.md`  
**Output Target:** `zoom_out_report.md`

---

## Executive Summary

The design presents a low-latency architecture for high-profile event registration, combining Dexie.js for offline resilience, Web Audio synthesis, hardware keystroke interception, and Convex reactive sync. 

However, evaluating the system from the **Zoom-Out Lens** (analyzing whole-lifecycle operational realities, human failure modes, external platform constraints, boundary conditions, and legal/regulatory compliance) reveals critical blind spots:
1. **Unencrypted VIP PII on Personal Devices:** Offline hydration stores unmasked VIP directories on volunteer devices without cache eviction or retention lifecycles, conflicting with the document's core VIP privacy mandate.
2. **WhatsApp Platform Reality vs. RM Distribution:** Meta Business API HSM template rules prohibit freeform dynamic broadcasts, and manual RM forwarding of dozens of loose PNG badge attachments introduces human error.
3. **Monotonic Session Capacity Tracking:** Breakout session capacity tracking is architecturally impossible without an exit scan / checkout mechanism.
4. **Auditability & Revocation Deficits:** Shared static gate passcodes prevent operator non-repudiation or individual station revocation, while the lack of ticket invalidation prevents re-issuing compromised passes.

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Plaintext Local Roster Caching on Unmanaged Devices Violates VIP Privacy & Data Retention Mandates - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 212-235, 266-267, 514-519
* **Discrepancy Description**: 
  The design specifies that upon shift entry, the gate station client downloads the complete attendee roster (~200 KB JSON with names, designations, corporate affiliations, emails, contact numbers, and RM referrer details) and writes it into browser IndexedDB (`Dexie.js`) on gate operators' personal or temporary mobile devices. The document heavily stresses "High-Profile Attendee Privacy Risks" and provides gate UI masking (`maskAttendeeDetailsAtGate: true`), but omits any data lifecycle management for the underlying local store. IndexedDB persists in plaintext on the device filesystem indefinitely. There is no session expiration, no automatic post-event cache purge, and no encryption-at-rest.
* **Rationale & Recommendation**: 
  Under modern privacy regulations (e.g., India's DPDP Act 2023, EU GDPR), storing plaintext VIP databases on unmanaged personal volunteer smartphones without access controls or automatic deletion is a severe compliance violation. If a volunteer's device is lost, sold, or inspected, the entire private guest list is compromised.
  * **Recommendation**: 
    1. When `maskAttendeeDetailsAtGate === true`, gate stations should receive a minimal "validation roster" containing only `{ ticketCode, category, allowedSessionIds, checkInStatus }` with masked name initials, rather than full PII.
    2. Implement an automatic session TTL and an explicit `purgeLocalDatabase()` routine triggered upon shift logout, gate teardown, or when `event.active === false`.

---

### 2. WhatsApp Meta Business API Policy Non-Compliance & Infeasible RM Manual Attachment Distribution - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 21, 39-40, 92-104, 434-467, 598-605
* **Discrepancy Description**: 
  The design contains two conflicting, operationally problematic WhatsApp distribution assumptions:
  1. *Broadcast via Zoho CPaaS (Lines 462-466, 601-604):* It specifies rich template customization with freeform textarea inputs and dynamic merge tags. However, Meta's WhatsApp Business Platform strictly mandates pre-registered and approved HSM (Highly Structured Message) templates; arbitrary message bodies cannot be composed and dispatched dynamically.
  2. *Relationship Manager (RM) Manual Distribution (Lines 448-460):* RMs receive an email with attached QR image files and a spreadsheet, and are expected to manually save each PNG and attach it to individual WhatsApp chats. For an RM handling 30-50 VIPs, manually cross-referencing and attaching individual PNG files is an enormous friction point prone to severe human error (e.g., sending Guest A's QR badge to Guest B).
* **Rationale & Recommendation**: 
  Operational workflows that rely on humans manually matching 50 image attachments on WhatsApp fail under event pressure. 
  * **Recommendation**:
    1. Standardize on the responsive web badge URL (`https://<domain>/t/:ticketCode`) as the primary distribution artifact. When shared, OpenGraph preview tags can display event branding and ticket status without requiring loose image attachments.
    2. Provide pre-built `https://wa.me/<phone>?text=<encoded_text>` deep-links directly in the RM client spreadsheet/dashboard, enabling RMs to initiate personalized WhatsApp chats with 1 click.
    3. Formally specify the Zoho CPaaS WhatsApp Media Template schema (Utility category, pre-approved header document/image variable) in Section 5.3.

---

### 3. Lack of Session Capacity Decrement (Exit Scan) Renders Breakout Limits Impossible to Enforce - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 308-309, 477-478, 574-575
* **Discrepancy Description**: 
  The schema defines `capacity: v.optional(v.number())` on `sessions` (line 308), the dashboard specifies "Active In-Session Count (per breakout room)" (line 477), and the gate displays "Session Mismatch / Restricted" warnings (line 574). However, the check-in mutation and data model are strictly unidirectional (`checkInStatus: "CHECKED_IN"`, `firstSeenAt`, `lastSeenAt`). There is no checkout mutation, decrement operation, or exit-scan mode.
* **Rationale & Recommendation**: 
  In multi-session conferences, attendees move between rooms throughout the day. Without an exit scan or session checkout mechanism, the "Active In-Session Count" will strictly monotonically increase until every room indicates 100% capacity, blocking valid attendees from entering.
  * **Recommendation**:
    * Either introduce a gate station mode toggle (`direction: "IN" | "OUT"`) that records room departures and decrements active occupancy, or clearly redefine `capacity` as "Total Cumulative Allocations" rather than "Concurrent Real-Time Room Occupancy".

---

### 4. Unverified Shared Passcode Authentication Prevents Station Auditability & Immediate Revocation - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 297, 634-640
* **Discrepancy Description**: 
  Gate operators log in using a single, static `gatePasscode` shared across all gates (line 297) and enter a self-declared `operatorName` into a plaintext input (line 637). 
* **Rationale & Recommendation**: 
  A single shared passcode lacks non-repudiation. If a volunteer shares the passcode or an untrusted device connects, an administrator cannot revoke that specific operator or station without changing the passcode for all other active gates. Furthermore, any user can type any arbitrary operator name (e.g. "Lead Admin"), corrupting the audit trail in `checkIns.operatorName` and bypassing privacy accountability when clicking "Show Details".
  * **Recommendation**: 
    * Replace the single shared passcode with an admin-generated station token / ephemeral QR login code (e.g., generated in `/admin` and scanned by the gate phone to pair the station), allowing 1-click station revocation from the admin dashboard.

---

### 5. Device Clock Skew & Half-Open Network Flapping Corrupt Offline Sync Ordering and UI Latency - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 83-86, 246, 271-277, 403-407
* **Discrepancy Description**: 
  Offline check-ins record the client device's local clock (`timestamp: number`), and sync replays them chronologically to Convex. Additionally, the sync worker relies on `window.addEventListener('online')` and `navigator.onLine`.
* **Rationale & Recommendation**: 
  1. *Clock Skew:* Mobile devices in convention basements frequently exhibit out-of-sync system clocks. If Gate 1 has a clock drifted 10 minutes fast and Gate 2 has a clock 5 minutes slow, replaying transactions will invert causal duplicate order and report incorrect collision attribution.
  2. *Network Flapping:* `navigator.onLine` returns `true` even when connected to an unresponsive venue Wi-Fi router with zero upstream routing. If the client waits for the default HTTP mutation timeout (30-60 seconds), the scanning UI will freeze during peak arrival surges.
  * **Recommendation**:
    * Track both `clientCapturedAt` and `serverSyncedAt` in `checkIns`. Use monotonic local sequence numbers for replay ordering.
    * Add an aggressive 1500 ms optimistic network timeout on Convex mutations before immediately demoting to local Dexie queueing, preventing gate screen freezes on degraded connections.

---

### 6. Email Attachment Size Limits & Serverless Action Timeouts on RM Bulk Packs - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 97-98, 448-460, 690-692
* **Discrepancy Description**: 
  The Convex action `sendRMInvitePacks` generates and attaches individual PNG QR code images and a spreadsheet directly to an outgoing email for each Relationship Manager.
* **Rationale & Recommendation**: 
  For an RM assigned 30 to 50 VIPs, attaching 50 high-resolution PNG images easily generates an email payload of 15-25 MB, exceeding standard SMTP and Zoho CPaaS gateway limits (typically 10-15 MB). Furthermore, generating dozens of image buffers and encoding attachments inside a serverless Convex action risks exceeding memory limits and the 60-second execution timeout.
  * **Recommendation**:
    * Attach only the client invite spreadsheet. For QR images, provide an authenticated, expiring 1-click download link (`https://event.app/rm-download/:token`) that delivers the RM's pre-compiled ZIP bundle from cloud storage.

---

### 7. Missing VIP Group / Delegation & Plus-One Check-In Workflow - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 72-76, 186-188, 216-235, 312-350
* **Discrepancy Description**: 
  The schema and check-in flow enforce a strict 1:1 relationship between attendee records and physical scans. There is no concept of plus-ones, spouse passes, or corporate delegations arriving together.
* **Rationale & Recommendation**: 
  At VIP conferences and galas, dignitaries rarely arrive alone; they arrive with assistants, spouses, or delegations whose passes are often held on a single phone. The 800 ms debounce cooldown and single-record verification UI force operators into awkward waiting loops and repetitive scans.
  * **Recommendation**:
    * Add an optional `parentAttendeeId` or `groupCode` to `attendees`, and display a "Party of [N] / Admit All" quick action on the gate terminal when a primary pass is scanned.

---

### 8. Missing Ticket Invalidation / Revocation & Re-Issuance Lifecycle - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 312-350, 681-684
* **Discrepancy Description**: 
  The `attendees` table only maintains `checkInStatus: "REGISTERED" | "CHECKED_IN"`. There is no ticket lifecycle state (`ACTIVE`, `REVOKED`, `TRANSFERRED`).
* **Rationale & Recommendation**: 
  If an attendee loses their phone, leaks their QR link, or cancels their registration, the organizer cannot invalidate the compromised nanoid without deleting the attendee record entirely.
  * **Recommendation**: Add `ticketStatus: v.union(v.literal("ACTIVE"), v.literal("REVOKED"), v.literal("EXPIRED"))` and a `reissueTicketCode` mutation.

---

### 9. Lack of Post-Event Reconciled Data Export and Historical Archival Policy - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 470-485, 580-591
* **Discrepancy Description**: 
  The admin dashboard focuses exclusively on live real-time metrics during the event, omitting post-event operational reporting.
* **Rationale & Recommendation**: 
  After the event concludes, organizers need to export the full reconciled check-in audit log (exact arrival timestamps, gate names, operator names, and check-in methods) for CRM ingestion (Zoho CRM / HubSpot) and executive debriefs.
  * **Recommendation**: Add a dedicated "Export Check-In Audit Log (CSV)" button and specify event archiving rules once `endDate` has passed.

---

### 10. RSVP State Change Notification Loop to Relationship Managers - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-zoom-out`
* **Affected Scope:** Lines 100-104, 416-430, 479-482
* **Discrepancy Description**: 
  When a guest confirms or declines via the public ticket page (`/t/:ticketCode`), Convex updates the admin dashboard table, but the Relationship Manager who personally invited the guest receives no update.
* **Rationale & Recommendation**: 
  RMs drive attendance through personal touch. If an RM does not know that their VIP declined or confirmed, they may send awkward, redundant follow-ups.
  * **Recommendation**: Provide an optional daily or real-time RM notification summary (email/WhatsApp webhook) alerting RMs when their invited VIPs update their RSVP status.

---

*Report written to zoom_out_report.md*
