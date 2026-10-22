# Step 6 Comprehension Test: Review Report

**Target:** `docs/designs/real-time-event-check-in-system.md` (`Lines 1-814`)  
**Evaluation Standard:** `resources/document_standards/re-implementation-standard.md` (Re-Implementation Standard & Zero-Assumption Rule)  
**Reviewer Lens:** `egm-comprehension`  
**Artifact:** `comprehension_report.md`

---

## Executive Summary

The specification `docs/designs/real-time-event-check-in-system.md` provides an extensive architectural blueprint for a real-time event check-in system utilizing React/Dexie.js PWAs and Convex cloud sync. 

However, evaluating the document strictly against the **Re-Implementation Standard** and **The Zero-Assumption Rule** reveals **3 Blockers**, **5 Major issues**, and **3 Nits**. Crucially, undefined contracts in the physical QR code payload format, missing application entrypoint and router configuration in the file manifest, and omitted Zoho CPaaS API/webhook specifications would force an implementer to make arbitrary architectural assumptions during code generation.

---

## Prioritized Findings (Blockers 🔴 -> Major 🟡 -> Nits 🟢)

### 1. Undefined QR Code Payload Contract (Token vs. URL Parsing Mismatch) - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 95–96, 101, 268, 439–440, 458, 612, 715
* **Discrepancy Description:** The specification creates a critical behavioral contradiction regarding what data is physically encoded into the QR code image:
  - Lines 101 and 458 describe the QR code as linking to the public pass URL: `https://<domain>/t/<ticketCode>`.
  - Lines 95 and 314 define `ticketCode` as a 12-character nanoid (e.g., `V1StGXR8_Z5j`).
  - Section 3.2 (Line 268) specifies that the gate scanner validates passes via:
    `attendees.where("ticketCode").equals(code).first()`.
  If the QR code image encodes the full URL (`https://event.app/t/V1StGXR8_Z5j`), scanning this code with the hardware scanner or camera passes the full URL string to `code`. Dexie will look up `ticketCode == "https://event.app/t/V1StGXR8_Z5j"`, which will return `null` and reject 100% of valid attendee passes. Conversely, if the QR code encodes only the raw 12-character token, attendees scanning their badges with personal phone cameras outside the gate will fail to navigate to the public `/t/:ticketCode` RSVP/details page.
* **Rationale & Recommendation:** The Zero-Assumption Rule explicitly forbids ambiguous input/output schemas. Specify the exact QR payload contract:
  1. Mandate that QR passes encode the full canonical URL (`https://<domain>/t/:ticketCode`).
  2. Explicitly specify that the client-side `TokenRouter` (or `useScanner` / `useCameraScanner`) parses incoming strings: if the scanned string begins with `http://` or `https://`, extract the trailing pathname segment (`ticketCode`) before querying Dexie or Convex.

---

### 2. Missing Application Routing Engine and Entrypoint Manifest - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 647–652, 729–752 (Section 3: Target Files to Create/Modify)
* **Discrepancy Description:** Section 3 defines 6 discrete page components (`LoginPage.tsx`, `GateCheckInPage.tsx`, `AdminDashboardPage.tsx`, `AttendeeManagerPage.tsx`, `TicketDispatchPage.tsx`, `PublicTicketPage.tsx`) bound to specific routes (`/login`, `/gate/:slug`, `/admin/events/:slug`, `/t/:ticketCode`, etc.). However:
  1. `package.json` (Line 647) completely omits any client-side routing dependency (e.g., `react-router-dom`).
  2. The target file manifest completely omits the React root application entrypoint (`src/main.tsx`), the router root component (`src/App.tsx`), and the Tailwind CSS entry stylesheet (`src/index.css`).
* **Rationale & Recommendation:** An engineer or AI following this specification cannot compile or run the application (`npm run dev` or `npm run build`), as there is no entrypoint to mount React, no router to map the 6 pages, and no CSS stylesheet. Add `react-router-dom` to `package.json` production dependencies. Add `src/main.tsx` (mounting ReactDOM and Convex provider), `src/App.tsx` (declaring `<BrowserRouter>`, `<Routes>`, and all 6 `<Route>` definitions), and `src/index.css` to the Target Files list in Section 3.

---

### 3. Omitted External Zoho CPaaS API Endpoints, Payloads, and Webhook Schema - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 156–167, 448–467, 517–518, 689–696
* **Discrepancy Description:** The specification requires dispatching single and batch tickets via Zoho CPaaS (`dispatchTicketBatch`, `sendRMInvitePacks`, `syncDeliveryStatusCron`), ingesting status updates at `POST /zoho-webhook`, and storing environment variables (`ZOHO_CPAAS_API_KEY`, `ZOHO_SENDER_ID`). However, it provides zero technical details regarding:
  1. The exact Zoho CPaaS REST API base URL and endpoint paths.
  2. The HTTP request method, authorization scheme/headers, and body format (JSON vs. multipart form-data).
  3. The schema of the inbound webhook payload sent to `POST /zoho-webhook` (field names for message ID, delivery status, timestamps).
  4. Webhook security authentication (HMAC signature header, query secret, or shared token).
  5. The status mapping table between Zoho CPaaS webhook status strings and the `deliveryLogs` enum (`"QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "BOUNCED"`).
* **Rationale & Recommendation:** The Re-Implementation Standard explicitly states: *"Include: External contracts (APIs, formats, side-effects)"*. A developer cannot implement `convex/zoho.ts` or `convex/http.ts` without inventing external payload schemas. Add an explicit "External Services Integration Contract" section documenting the Zoho REST request payloads, webhook JSON structure, authentication headers, and status mapping table.

---

### 4. Multi-Session Cloud Schema vs. Single-Session Client Local Schema Asymmetry - Severity: 🟡 Major
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 216–235, 258–262, 352–367, 400–408
* **Discrepancy Description:** In Convex, check-ins are explicitly scoped per session via the compound index `["sessionId", "attendeeId"]` on the `checkIns` table, enabling an attendee to check into multiple distinct sessions across an event (e.g., Main Keynote, Breakout Room 1). However, in the client IndexedDB schema (`GateLocalDatabase` in Dexie.js), `LocalAttendee` only contains a single scalar field:
  `checkInStatus: "REGISTERED" | "CHECKED_IN"`, and Dexie defines no local `checkIns` table. Once an attendee checks into Session 1 while offline, their local record is updated to `"CHECKED_IN"`. When they later scan at Session 2:
  - If the station checks `LocalAttendee.checkInStatus`, it will incorrectly reject them as already checked in.
  - Furthermore, once `checkInQueue` items are synced to Convex and deleted, the local client has no persistent store of which sessions an attendee has completed.
* **Rationale & Recommendation:** The client-side database schema cannot faithfully represent the cloud data model's multi-session capabilities during offline operation. Update `LocalAttendee` in `src/lib/db.ts` to store `checkedInSessionIds: string[]` instead of a flat `checkInStatus` string, or add a `localCheckIns` table in Dexie keyed by `[sessionId+attendeeId]`.

---

### 5. Unspecified Session Assignment & Resolution at Gate Station Initialization - Severity: 🟡 Major
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 229, 270, 567, 574, 637–638, 753–756
* **Discrepancy Description:** Line 637 states that when an operator opens the gate terminal, they enter the Event Passcode, display name, and select their gate (`gateId`), but makes no mention of selecting an active session. Yet, Line 567 specifies a sticky header session badge ("Main Entry - Primary"), Line 240 requires `sessionId` in `QueuedCheckIn`, and Line 270 requires checking "local session permissions". The specification fails to define:
  1. How `sessionId` is assigned to a gate terminal (does `GateLoginModal` require choosing a session, or does it automatically bind to the event's primary session `isPrimary: true`?).
  2. How `allowedSessionIds` is evaluated when undefined or empty (does an attendee without explicit session restrictions have access to all sessions, only primary sessions, or none?).
* **Rationale & Recommendation:** Update `GateLoginModal` to include session selection (or specify that it defaults to the primary session with an in-header session switch dropdown). Explicitly declare the evaluation rule: `if (!attendee.allowedSessionIds || attendee.allowedSessionIds.length === 0 || attendee.allowedSessionIds.includes(activeSessionId)) -> PERMIT`.

---

### 6. Missing Local Duplicate Scan Prevention Step in Offline Evaluation Lifecycle - Severity: 🟡 Major
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 85, 267–277 (Section 3.2: Pre-Event Hydration & Local Verification Lifecycle)
* **Discrepancy Description:** In Section 3.2, Step 2 ("Scan Verification") details the exact local evaluation steps:
  1. Look up `attendees.where("ticketCode").equals(code).first()`.
  2. If not found, trigger invalid scan error.
  3. If found, check local session permissions. If valid, play success tone and display green banner.
  Notice that Step 2 completely omits checking whether the attendee has ALREADY been admitted locally! If the same badge is presented twice at an offline gate station, Step 2 will evaluate it as valid, play the green success chime, and enqueue a duplicate check-in. While CUJ 3 (Line 85) mentions "marks the local record as checked in", the formal algorithmic lifecycle in Section 3.2 omits verifying `checkInStatus` prior to admission.
* **Rationale & Recommendation:** Insert an explicit duplicate validation check into Section 3.2 Step 2: *"Check if attendee has already checked into the active session (via `LocalAttendee.checkedInSessionIds` or `checkInQueue`). If already checked in, immediately play the 150 Hz error tone, display the crimson duplicate card, and do not enqueue a new check-in."*

---

### 7. Scalability & Delivery Failure Risk in Relationship Manager Email Packs - Severity: 🟡 Major
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 97, 447–461, 600, 690
* **Discrepancy Description:** Section 5.2 states that `sendRMInvitePacks` dispatches an email to each Relationship Manager containing individually attached high-resolution PNG QR images for each assigned guest, alongside a client spreadsheet. For an RM managing 30 to 80 guests, attaching 30–80 individual binary PNG images directly to a single email will exceed SMTP attachment size limits (typically 10 MB to 25 MB) and Zoho CPaaS payload limits, causing the action to crash or be rejected.
* **Rationale & Recommendation:** Specify that for RMs with more than 5 assigned guests (or universally), the backend packages their QR passes into a single compressed sub-ZIP archive (`RM_Packs_[RM_Name].zip`) matching the Mode 2 export structure, or embeds secure hosted image download URLs, with individual attachments limited to small batches.

---

### 8. CSV Roster Ingestion Validation & Default Value Ambiguities - Severity: 🟡 Major
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 93–95, 312–350, 593, 683
* **Discrepancy Description:** The attendee batch import (`batchImportAttendees`) specifies ingesting 10 CSV columns, but does not define behavior for common data edge cases:
  1. Duplicate emails within the same event: The schema defines an index on `["eventId", "email"]`. Does the import abort atomically, skip duplicate rows, or overwrite existing records?
  2. Default values: What initial values are assigned to `rsvpStatus` (presumably `"PENDING"`), `checkInStatus` (presumably `"REGISTERED"`), and `allowedSessionIds`?
  3. Category parsing: The schema enforces a strict union (`"SPONSOR" | "VISITOR" | "VIP" | "ORGANIZER"`). How does the auto-mapper handle lowercase `"vip"`, unknown categories (e.g., `"Speaker"`), or empty cells?
* **Rationale & Recommendation:** Document exact CSV import validation rules: define fallback category (`"VISITOR"`), specify case-insensitive category matching, establish default `rsvpStatus: "PENDING"` and `checkInStatus: "REGISTERED"`, and define duplicate email resolution policy (e.g. skip duplicate emails and return an error summary array).

---

### 9. Missing iOS Web API Compatibility Guards (`navigator.vibrate`) - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 193, 723
* **Discrepancy Description:** Line 193 specifies that the camera scanner invokes `navigator.vibrate(100)` upon decoding a QR code. On iOS Safari and WKWebView, `navigator.vibrate` is not implemented; calling it directly without an existence check throws a runtime `TypeError`.
* **Rationale & Recommendation:** Specify defensive invocation in `useCameraScanner`: `if ("vibrate" in navigator) { navigator.vibrate(100); }`.

---

### 10. Undefined Attendee Name Privacy Masking Heuristics - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 204, 572
* **Discrepancy Description:** Line 204 illustrates masking with an example (`A**** G*******`), but does not define the algorithmic rules for single-token names, names with middle initials, short names (<=2 chars), or whether email/phone numbers in the manual search drawer are masked when `maskAttendeeDetailsAtGate: true`.
* **Rationale & Recommendation:** Explicitly define the masking utility function (e.g., preserve first character of each word, mask remaining letters with up to 4 asterisks), and specify whether the manual search drawer displays unmasked profiles or requires clicking "Show Details".

---

### 11. Public Ticket RSVP Idempotency and 404 Error State Handling - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-comprehension`
* **Affected Scope:** Lines 410–415, 607–623, 750–752
* **Discrepancy Description:** Section 1.5 describes the public ticket page and 3-way RSVP buttons transitioning to a thank-you state upon submission. It does not clarify whether a user can subsequently change their RSVP response (e.g., changing from "Maybe" to "Yes" if their schedule confirms), nor does it specify the UI state if an attendee opens an invalid or expired `ticketCode`.
* **Rationale & Recommendation:** Clarify whether RSVP responses are editable upon page reload, and specify a standard 404 "Pass Not Found" error card component for unrecognized ticket tokens.
