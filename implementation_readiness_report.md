# Implementation Readiness Review Report

**Target:** `docs/designs/real-time-event-check-in-system.md` (`Lines 540-814`)  
**Standard:** `resources/document_standards/implementation-readiness-standard.md` (Zero-Decision Rule, Phasing & Checkpoints, Target Scope, Actionable Steps, Test Plan)  
**Reviewer Lenses:** `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`  
**Overall Verdict:** ❌ **FAILED (5 Blockers, 5 Major, 4 Nits)** — Requires revision before code generation.

---

## Executive Summary

The Detailed Implementation Plan in Section 540-814 provides a comprehensive inventory of 35 files, UI states, and verification steps. However, it **fails** the Implementation Readiness Standard on two fundamental counts:
1. **Zero Phasing & Checkpoints**: The plan presents a flat, unphased file list without incremental execution phases or intermediate testable milestones.
2. **Zero-Decision Rule Breaches**: An engineer executing this plan is forced to make critical architectural choices: choosing a client router, resolving a fatal Convex table collision between `@convex-dev/auth` and event `sessions`, creating missing application entrypoints (`main.tsx`, `App.tsx`, `index.css`), designing the unauthenticated public ticket query, and inventing the Zoho CPaaS API integration contracts.

Below is the prioritized audit breakdown categorized by severity.

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Missing Phasing & Checkpoints Architecture - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 540–814 (Entire Detailed Implementation Plan)
* **Discrepancy Description**: The plan completely lacks partitioned incremental phases. It presents a flat list of 35 files to create, with no logical execution order, verification milestones, or checkpoints. This directly violates the core requirement: *"The plan must partition the work into logical, incremental phases. Each phase must leave the codebase in a stable, buildable, and testable state."*
* **Rationale & Recommendation**: Partition the implementation plan into 5 sequential phases, each with explicit exit criteria:
  * **Phase 1: Project Scaffolding & Convex Data Layer**: `package.json`, Vite/TS config, Tailwind, Convex Auth, schema, seed/mock data, and core database queries/mutations.
  * **Phase 2: Client Core & Hardware/Audio Engine**: `db.ts` (Dexie), Web Audio API chimes, screen wake lock, and hardware keystroke accumulator (`useScanner`).
  * **Phase 3: Gate Terminal Experience**: `/gate/:slug` UI, shift setup modal, privacy-masked status card, camera scanner modal, and offline sync hook.
  * **Phase 4: Admin Dashboard & Attendee Management**: `/admin/events/:slug`, CSV importer with column mapping, live arrival stream, RM RSVP breakdown table, and timeline drawer.
  * **Phase 5: Ticket Dispatch, ZIP Bundler & Public RSVP Ticket**: `exportZip.ts` (bulk & RM sub-packs), Zoho CPaaS action & webhook handler, and `/t/:ticketCode` 3-way RSVP page with celebration animations.

---

### 2. Missing Core Application Entrypoints & Client Routing Scaffold - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-codebase-details` / `egm-implementation-readiness`
* **Affected Scope:** Lines 645–660 (Files 1–5), Lines 729–752 (Files 22–27)
* **Discrepancy Description**: Section 3 lists 6 distinct URL routes (`/gate/:slug`, `/admin/events/:slug`, `/admin/events/:slug/attendees`, `/admin/events/:slug/dispatch`, `/t/:ticketCode`, `/login`), but `package.json` (File 1) omits a routing dependency (e.g., `react-router-dom`). Furthermore, the target files list omits the three foundational entrypoints: `src/main.tsx` (DOM mount & provider binding), `src/App.tsx` (router & layout definitions), and `src/index.css` (Tailwind `@tailwind` directives).
* **Rationale & Recommendation**: 
  1. Add `react-router-dom: "^6.22.0"` to `package.json` dependencies.
  2. Add `src/main.tsx`, `src/App.tsx`, and `src/index.css` as explicit target files.
  3. Detail the provider hierarchy in `src/App.tsx`: `ConvexAuthProvider` wrapping `BrowserRouter` with route guards redirecting unauthenticated users from `/admin/*` to `/login`.

---

### 3. Database Schema Table Collision: `sessions` vs. Convex Auth - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 302–310, Lines 665–672 (Files 6 & 7)
* **Discrepancy Description**: File 6 defines database tables including `sessions` (representing event sub-sessions and breakout rooms: `eventId`, `title`, `isPrimary`, etc.). Simultaneously, File 7 configures `@convex-dev/auth`, which generates its own internal `sessions` table (from `authTables`) for managing user authentication sessions. Convex table names must be strictly unique within `defineSchema()`. This naming collision causes a fatal schema compilation failure.
* **Rationale & Recommendation**: Rename the event sub-session table to `eventSessions` across `convex/schema.ts`, `convex/sessions.ts`, `convex/checkIns.ts`, Dexie `LocalAttendee.allowedSessionIds`, and UI components. Reserve `sessions` exclusively for `@convex-dev/auth`.

---

### 4. Missing Public Ticket Query & Severe Contact Exposure Vector - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-implementation-readiness` / `egm-codebase-details`
* **Affected Scope:** Lines 681–684 (File 10: `convex/attendees.ts`), Lines 749–752 (File 27)
* **Discrepancy Description**: The public ticket page (`/t/:ticketCode`) allows guests to view their badge and submit 3-way RSVP responses without logging in. However, File 10 only lists `getRoster`, `batchImportAttendees`, `searchAttendees`, `updateAttendee`, `confirmRsvp`, and `getRMStats`. There is no public read query for ticket data. If an implementer exposes `getRoster` publicly to satisfy this, the entire guest list (400 VIPs, emails, phone numbers) is leaked.
* **Rationale & Recommendation**: Add a dedicated public query to `convex/attendees.ts`:
  ```typescript
  export const getPublicTicket = query({
    args: { ticketCode: v.string() },
    handler: async (ctx, args) => {
      // Look up attendee by ticketCode compound index
      // Return strictly safe public fields: attendee firstName, masked lastName, category,
      // event title, venueName, venueAddress, startDate, endDate, and rsvpStatus.
    }
  });
  ```

---

### 5. Unspecified Zoho CPaaS Integration Contract & Action Runtime - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-implementation-readiness` / `egm-codebase-details`
* **Affected Scope:** Lines 448–466 (Section 5), Lines 689–692 (File 12: `convex/zoho.ts`)
* **Discrepancy Description**: File 12 states that `sendRMInvitePacks` generates emails with attached QR badges and attached client spreadsheets, and `dispatchTicketBatch` calls Zoho CPaaS. However, it leaves zero technical guidance on: (1) Zoho CPaaS API endpoints, authentication headers, or request payload structures; (2) how binary PNG QR images and CSV spreadsheets are generated inside a Convex action without Node.js runtime declarations; and (3) what environment variables must be configured.
* **Rationale & Recommendation**:
  1. Declare `"use node";` at the top of `convex/zoho.ts`.
  2. Document the exact Zoho CPaaS REST API endpoint (`https://api.zoho.com/cpaas/v1/...` or ZeptoMail equivalent), header contract (`Authorization: Zoho-enczapikey <KEY>`), and payload schema.
  3. Detail that QR attachments must be converted to base64 data strings using `qrcode.toBuffer()` and attached as inline MIME parts.
  4. List required secrets: `ZOHO_CPAAS_API_KEY`, `ZOHO_SENDER_ID`, `APP_BASE_URL`.

---

### 6. Destructive Global Keystroke Interception in `useScanner` - Severity: 🟡 Major
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 717–720 (File 19: `src/hooks/useScanner.ts`), Lines 174–188
* **Discrepancy Description**: `useScanner` attaches a global capturing `keydown` listener to `window` and stops event propagation upon encountering `Enter`. It does not check if the active focused element is an `<input>` or `<textarea>`. When an operator searches for an attendee in `ManualSearchModal`, inputs a gate passcode, or types in the admin template editor, pressing `Enter` will be swallowed by the hook, preventing form submissions and search executions.
* **Rationale & Recommendation**: Update the hook specification to explicitly exclude editable elements:
  ```typescript
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    return; // Pass through normal keyboard events
  }
  ```

---

### 7. Ambiguous Gate Passcode Authentication & Session Validation - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 634–640 (Section 2), Lines 673–675 (File 8)
* **Discrepancy Description**: Section 2 states that gate operators enter an Event Passcode, the client validates it via `verifyGatePasscode`, and "caches the temporary gate session token in `localStorage`". However, the plan does not define what this token is, how it is generated, what table stores it, or how backend mutations (`recordCheckIn`) validate it. If `verifyGatePasscode` is a query, queries cannot write session tokens to the database.
* **Rationale & Recommendation**: Explicitly define `verifyGatePasscode` as a Convex mutation that returns an HMAC-signed gate token (incorporating `eventId`, `gateId`, and `exp`), or define a `gateSessions` table in `convex/schema.ts` tracking active operator sessions. Specify that `recordCheckIn` validates this session token on incoming requests.

---

### 8. Contradictory Scan Evaluation Flow (Optimistic Local vs. Authoritative Server) - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness` / `egm-codebase-details`
* **Affected Scope:** Lines 725–728 (File 21), Lines 267–276 (Section 3.2), Lines 77–81 (CUJ 2)
* **Discrepancy Description**: Section 3.2 states that when a barcode is scanned, the client verifies it against Dexie locally, immediately plays the green success tone, and queues the mutation for sync. However, CUJ 2 states that when Attendee B presents a duplicate pass at Gate 2, Convex atomically rejects it with a crimson card and error buzz. If Gate 2 checks Dexie locally first without waiting for Convex, Gate 2 will emit a green success chime before Convex returns the duplicate error.
* **Rationale & Recommendation**: Explicitly specify the branch logic in `useOfflineSync.ts`:
  * **Online Mode (`navigator.onLine === true`)**: Dispatch `recordCheckIn` to Convex with a 250 ms timeout. Trigger green/red AV feedback strictly based on the server response.
  * **Offline Mode (`navigator.onLine === false`)**: Fall back to local Dexie verification, play local feedback, and enqueue into `checkInQueue`. Flag any subsequent cross-gate collisions upon reconnection via non-blocking toasts.

---

### 9. Arbitrary Dexie Schema Version & Missing ZIP Download Utility - Severity: 🟡 Major
* **Reviewer Lens:** `egm-codebase-details` / `egm-style`
* **Affected Scope:** Lines 701–704 (File 15), Lines 713–716 (File 18), Line 257
* **Discrepancy Description**: The Dexie snippet declares `this.version(4).stores(...)` for a brand-new project with no prior versions. Additionally, `package.json` includes `jszip` but omits a file-saving library (e.g., `file-saver`), leaving the browser download mechanism ambiguous.
* **Rationale & Recommendation**:
  1. Set `this.version(1).stores(...)` in `src/lib/db.ts`.
  2. Document in `src/lib/exportZip.ts` that the generated ZIP blob is downloaded via `URL.createObjectURL(blob)` linked to a synthetic `<a download="attendees.zip">` element, avoiding unnecessary third-party dependencies.

---

### 10. Incomplete Test Plan Coverage for Critical Subsystems - Severity: 🟡 Major
* **Reviewer Lens:** `egm-implementation-readiness`
* **Affected Scope:** Lines 765–784 (Files 31–35), Lines 795–797
* **Discrepancy Description**: The test plan lists 5 unit test files (`useScanner`, `checkIns`, `audio`, `offlineQueue`, `auth`), but omits test coverage for core business features: CSV import column auto-mapping, RM stats grouping calculation, 3-way RSVP state transitions, and dual-mode ZIP export structure generation.
* **Rationale & Recommendation**: Add the following explicit test files to Section 3 and the Verification Plan:
  * `tests/unit/csvImport.test.ts`: Validates PapaParse column mapping, phone normalization, and nanoid assignment.
  * `tests/unit/rmStats.test.ts`: Validates `getRMStats` aggregation across Yes, No, Maybe, and Pending.
  * `tests/unit/rsvp.test.ts`: Validates `confirmRsvp` mutation idempotency and public state updates.
  * `tests/unit/exportZip.test.ts`: Validates JSZip folder hierarchy for both flat and RM sub-ZIP modes.

---

### 11. Undefined Predefined Gate Roster Entity - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-style` / `egm-codebase-details`
* **Affected Scope:** Lines 578, 637, 754 (File 28)
* **Discrepancy Description**: The gate operator login modal prompts the user to "select their gate", but gates are not defined as an entity or array in `convex/schema.ts`.
* **Rationale & Recommendation**: Add `gates: v.optional(v.array(v.string()))` to the `events` table in `convex/schema.ts` (defaulting to `["Main Gate", "VIP Gate", "East Door"]`), allowing the modal dropdown to populate dynamically.

---

### 12. Unspecified SVG QR Code Rendering Strategy - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Line 612, Line 751 (File 27)
* **Discrepancy Description**: Line 612 specifies a "high-contrast SVG QR code", while `package.json` installs `qrcode`. It does not specify whether SVG strings are rendered via `QRCode.toString()` into a `dangerouslySetInnerHTML` container or using a specialized React SVG component.
* **Rationale & Recommendation**: Specify that `src/pages/PublicTicketPage.tsx` uses `QRCode.toDataURL(ticketCode, { type: "image/png", margin: 2, width: 300 })` rendered in a standard `<img>` tag, avoiding SVG XSS sanitation risks.

---

### 13. Missing Handling for Unassigned / Direct Registrations in RM Analytics - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-codebase-details`
* **Affected Scope:** Lines 417–430, Line 683 (File 10)
* **Discrepancy Description**: `getRMStats` groups attendees by `referrerEmail`. Attendees who register directly without a Relationship Manager (`referrerEmail` is undefined) are not accounted for in the summary interface.
* **Rationale & Recommendation**: Explicitly define that `getRMStats` assigns unreferred attendees to a synthetic bucket: `{ referrerName: "Direct / Organic", referrerEmail: "none", ... }`.

---

### 14. Lack of Tailwind CSS v3 vs. v4 Version Pinning - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-style` / `egm-codebase-details`
* **Affected Scope:** Line 647 (File 1), Line 658 (File 4)
* **Discrepancy Description**: File 4 specifies `tailwind.config.js` and `postcss.config.js`. Tailwind CSS v4 replaces configuration files with CSS-only `@theme` declarations. An unpinned `tailwindcss` dependency will install v4 and fail with the provided configuration.
* **Rationale & Recommendation**: Pin `tailwindcss: "^3.4.1"` and `postcss: "^8.4.35"` in `package.json`.
