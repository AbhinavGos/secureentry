# Consolidated Goldfish Review Report

**Target Document:** `docs/designs/real-time-event-check-in-system.md` (`Lines 1-814`)  
**Review Preset:** Consolidated report with all review rubrics (Uninterrupted Full Flow)  
**Stages Executed:**
1. Stage 5: Initial Zoom Out Review (`zoom_out_report.md`)
2. Stage 6: Comprehension Test (`comprehension_report.md`)
3. Stage 7: Critic Review (`critic_report.md`)
4. Stage 8: Intermediate Zoom Out Review (`intermediate_zoom_out_report.md`)
5. Stage 9: Implementation Readiness Test (`implementation_readiness_report.md`)

---

## 1. Executive Summary

A comprehensive, multi-lens Goldfish Swarm review was conducted on `docs/designs/real-time-event-check-in-system.md` across high-level architecture, developer comprehension, structural specification quality, whole-lifecycle operational cohesion, and zero-decision implementation readiness.

Across all review stages, the core foundation—a low-latency hybrid pairing of **Dexie.js (IndexedDB)** for offline hardware barcode scanning, **Convex** for authoritative reactive synchronization and duplicate prevention, and the **Web Audio API** for sub-10 ms auditory feedback—was validated as sound and optimal for high-speed event check-ins.

However, the swarm identified **8 Blockers**, **8 Major issues**, and **12 Nits** that must be resolved in the design document before proceeding to production code generation. The primary issues and user clarifications center around:
1. **Gate Volunteer Device Privacy Sanitization:** Volunteer gate devices must only store and display the attendee ID / ticket code, category (e.g. VIP), and admission status (ALLOWED / NOT ALLOWED). Full names, phone numbers, emails, and designations are not displayed on volunteer screens and are excluded from the pre-cached local Dexie store.
2. **Raw Token QR Encoding (No URLs in QR):** The QR code encodes strictly the unique attendee ticket code / hex token (e.g., 12-char nanoid `V1StGXR8_Z5j` or `ATT-8F3A29`), NOT a URL. This minimizes QR density, accelerates optical scan recognition on budget hardware (e.g. Helett HT20), and simplifies lookup. The public ticket link (`https://<domain>/t/:ticketCode`) is distributed separately.
3. **Missing Routing & Entrypoints in Manifest:** `package.json` omits `react-router-dom`, and the file manifest omits `src/main.tsx`, `src/App.tsx`, and `src/index.css`.
4. **Implementation Plan Phasing & Schema Clashes:** Section 540–814 lacks sequential execution phases, collisions exist between `@convex-dev/auth` and event `sessions`, and Zoho CPaaS action contracts need explicit definition.
5. **Human 1-on-1 RM WhatsApp Distribution (No Meta API Bot):** Automated WhatsApp broadcasting via Meta API is explicitly out of scope. Instead, organizers export ZIP packs (flat or partitioned by Relationship Manager). Each RM sub-pack contains their guests' individual QR PNG images and a spreadsheet with ticket links and pre-formatted invite copy. RMs send these personally on a 1-on-1 basis via WhatsApp. Browser JSZip generation will be batched safely to prevent tab crashes.

---

## 2. Master Traceability Matrix

The matrix below maps raw stage findings to the consolidated, deduplicated action items:

| Consolidated Item | Severity | Stage 5 (Zoom Out) | Stage 6 (Comprehension) | Stage 7 (Critic) | Stage 8 (Interm Zoom) | Stage 9 (Readiness) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **B1: Sanitize Local Gate Roster & Purge PII** | 🔴 Blocker | Finding #1 | Finding #10 | Finding #3 | Finding #1 | — |
| **B2: Raw Token QR Encoding (No URLs in QR)** | 🔴 Blocker | — | Finding #1 | — | Finding #3 | — |
| **B3: Add Routing, App Entrypoints & Dependencies** | 🔴 Blocker | — | Finding #2 | — | Finding #3 | Finding #2 |
| **B4: Structure Plan into 5 Phased Milestones** | 🔴 Blocker | — | — | — | — | Finding #1 |
| **B5: Rename `sessions` to `eventSessions` (Auth Collision)**| 🔴 Blocker | — | — | — | — | Finding #3 |
| **B6: Document Zoho CPaaS Specs & Webhook Auth** | 🔴 Blocker | Finding #6 | Finding #3 | Finding #5 | Finding #3 | Finding #5 |
| **B7: Add Dedicated Safe `getPublicTicket` Query** | 🔴 Blocker | — | — | — | — | Finding #4 |
| **B8: Human 1-on-1 RM WhatsApp & Safe ZIP Generation** | 🔴 Blocker | Finding #2 | Finding #7 | Finding #4, #8 | Finding #2 | — |
| **M1: Multi-Session Dexie Schema & Direction Model** | 🟡 Major | Finding #3 | Finding #4 | — | Finding #4 | — |
| **M2: Local Duplicate Check & Sync Clock Drift** | 🟡 Major | Finding #5 | Finding #5 | Finding #2 | Finding #5 | Finding #8 |
| **M3: Exclude Form Inputs in Scanner Key Listener** | 🟡 Major | — | — | Finding #6 | — | Finding #6 |
| **M4: Station Pairing Tokens & Passcode Hashing** | 🟡 Major | Finding #4 | — | Finding #7 | Finding #6 | Finding #7 |
| **M5: Synchronous Scan Branching Logic** | 🟡 Major | — | — | — | — | Finding #8 |
| **M6: Group / Spouse Entourage Quick-Admission** | 🟡 Major | Finding #7 | — | — | Finding #7 | — |
| **M7: CSV Column Auto-Mapping & Fallback Normalization** | 🟡 Major | — | Finding #8 | — | — | Finding #10 |
| **M8: Complete Verification Plan & Unit Test Suite** | 🟡 Major | — | — | — | — | Finding #10 |
| **N1: Add Dedicated Risks & Mitigations Section (H2)**| 🟢 Nit | — | — | Finding #1, #9 | Finding #11 | — |
| **N2: Standardize Dividers (`---`) and Objective Tone** | 🟢 Nit | — | — | Finding #10, #11| Finding #11 | Finding #9 |
| **N3: Post-Event Reconciled CSV Audit Export** | 🟢 Nit | Finding #9 | — | — | Finding #8 | — |
| **N4: Ticket Invalidation (`ticketStatus`) & Re-Issuance** | 🟢 Nit | Finding #8 | — | — | Finding #9 | — |
| **N5: Real-Time / Daily RM RSVP Alert Summaries** | 🟢 Nit | Finding #10 | — | — | Finding #10 | — |
| **N6: Algorithmic Attendee Masking Heuristics** | 🟢 Nit | — | Finding #10 | — | — | — |
| **N7: Public Ticket 404 & RSVP Idempotency Rules** | 🟢 Nit | — | Finding #11 | — | — | — |
| **N8: AudioContext Autoplay & Unlock Safeguard** | 🟢 Nit | — | Finding #9 | — | — | — |
| **N9: Predefined Gate Entity (`events.gates`)** | 🟢 Nit | — | — | — | — | Finding #11 |
| **N10: Standardize PNG QR Code Rendering (`<img>`)** | 🟢 Nit | — | — | — | — | Finding #12 |
| **N11: Handle Organic / Unreferred Guests in RM Stats** | 🟢 Nit | — | — | — | — | Finding #13 |
| **N12: Pin Tailwind CSS v3 (`^3.4.1`) & PostCSS** | 🟢 Nit | — | — | — | — | Finding #14 |

---

## 3. Prioritized Actionable Remediations

### 🔴 Blockers (Must resolve before code generation)

#### B1. Sanitize Gate Local Roster & Purge PII
* **Root Cause:** Section 3 hydrates full unencrypted VIP records (`firstName`, `lastName`, `email`, `contactNumber`, `designation`, `organization`) into Dexie IndexedDB on personal devices, defeating UI privacy masking (`maskAttendeeDetailsAtGate: true`) and violating data protection regulations.
* **Remediation:**
  1. On the gate volunteer's device, the screen strictly displays only:
     - **Admission Status:** `VALID PASS - ADMIT` (Green) or `ALREADY CHECKED IN` / `INVALID PASS` (Crimson)
     - **Attendee / Pass ID:** e.g., `ATT-409` (or masked ID)
     - **Category Badge:** e.g., `VIP`, `DELEGATE`, `GENERAL`
     - The attendee's full name, phone number, email, and designation are completely hidden from the volunteer UI.
  2. In `convex/attendees.ts`, the hydration query (`getRoster`) for gate devices strictly projects only validation fields: `{ ticketCode, category, allowedSessionIds, checkInStatus }`. Personal contact numbers, emails, names, and designations are never downloaded or stored in Dexie on volunteer phones.
  3. Implement `purgeLocalDatabase()` in `src/lib/db.ts` executed automatically upon shift logout or when `event.active === false`.

#### B2. Raw Token QR Encoding (No URLs in QR Code)
* **Root Cause:** Reviewers previously debated parsing URLs vs. tokens. The user clarified the fundamental architectural requirement: the QR code contains strictly the raw unique attendee ticket token / hex code (e.g., 12-char nanoid `V1StGXR8_Z5j` or `ATT-8F3A29`), NOT a URL. The public pass URL (`https://<domain>/t/:ticketCode`) is distributed separately.
* **Remediation:**
  1. Standardize that all generated QR codes (for emails, badge PNGs, ZIP exports, and public pass web displays) encode strictly the raw `ticketCode` string.
  2. The gate scanner directly queries `attendees.where("ticketCode").equals(rawToken)`.
  3. Add input hygiene in `useScanner`: trim leading/trailing whitespace and strip non-printable characters.
  4. (Optional safety fallback): If a user scans a raw full URL (e.g. if someone accidentally points a scanner at an external browser address bar), the parser extracts the trailing token following `/t/`.

#### B3. Add Client Routing Scaffold, Application Entrypoints & Dependencies
* **Root Cause:** `package.json` omits `react-router-dom`, and the file manifest omits `src/main.tsx`, `src/App.tsx`, and `src/index.css`.
* **Remediation:**
  1. Add `react-router-dom: "^6.22.0"` to dependencies in `package.json`.
  2. Add `src/main.tsx` (ReactDOM render, `ConvexAuthProvider`, `BrowserRouter`).
  3. Add `src/App.tsx` (Route declarations for `/gate/:slug`, `/admin/events/:slug`, `/admin/events/:slug/attendees`, `/admin/events/:slug/dispatch`, `/t/:ticketCode`, and `/login` with auth guards).
  4. Add `src/index.css` (Tailwind `@tailwind base; @tailwind components; @tailwind utilities;` directives and WiserStack custom color variables).

#### B4. Structure Implementation Plan into 5 Phased Milestones
* **Root Cause:** Section 540–814 lists 35 target files without logical sequencing, violating the Implementation Readiness Standard.
* **Remediation:** Partition Section 540–814 into 5 sequential phases:
  * **Phase 1: Project Scaffolding & Convex Data Layer** (Config, Auth, `schema.ts`, `seed.ts`, database mutations/queries).
  * **Phase 2: Client Core, Storage & Audio Engine** (`db.ts`, Web Audio chimes, Screen Wake Lock, `useScanner`).
  * **Phase 3: Gate Terminal Experience** (`/gate/:slug`, Passcode gate modal, Masked check-in card, Camera fallback, Offline sync).
  * **Phase 4: Admin Dashboard & Attendee Management** (`/admin/*`, CSV importer, Real-time counters, RM analytics).
  * **Phase 5: Ticket Dispatch, ZIP Bundler & Public RSVP Page** (`exportZip.ts`, Zoho CPaaS integration, `/t/:ticketCode` pass).

#### B5. Rename `sessions` to `eventSessions` (Convex Auth Table Collision)
* **Root Cause:** Event breakout sessions table named `sessions` collides with `@convex-dev/auth` internal session management table in `authTables`.
* **Remediation:** Rename the breakout session table to `eventSessions` across `convex/schema.ts`, `convex/sessions.ts`, `convex/checkIns.ts`, Dexie `LocalAttendee`, and UI components.

#### B6. Document Zoho CPaaS Integration Contracts & Webhook Security
* **Root Cause:** `convex/zoho.ts` and `/zoho-webhook` lack API endpoint definitions, authorization headers, environment variables, and HMAC webhook authentication.
* **Remediation:**
  1. Declare `"use node";` at the top of `convex/zoho.ts`.
  2. Document the exact Zoho CPaaS REST API endpoint, authorization headers (`Authorization: Zoho-enczapikey <KEY>`), and JSON payload structures for transactional ticket emails.
  3. In `convex/http.ts`, implement HMAC-SHA256 signature verification for inbound webhooks on `POST /zoho-webhook` against `ZOHO_WEBHOOK_SECRET`.
  4. Note: Environment variable secrets (`ZOHO_CPAAS_API_KEY`, `ZOHO_SENDER_ID`, `ZOHO_WEBHOOK_SECRET`, `APP_BASE_URL`) will be provided subsequently by the user upon deployment.

#### B7. Add Dedicated Public Ticket Query (`getPublicTicket`)
* **Root Cause:** Public ticket page `/t/:ticketCode` has no safe read query, creating risk of leaking the full attendee roster if `getRoster` is exposed.
* **Remediation:** Add `getPublicTicket` query in `convex/attendees.ts` taking `{ ticketCode: v.string() }`. Return strictly non-sensitive fields: `{ attendee: { firstName, lastNameMasked, category, rsvpStatus }, event: { title, venueName, venueAddress, startDate, endDate, primaryColor } }`.

#### B8. Human 1-on-1 RM WhatsApp Workflow & Client-Safe ZIP Export
* **Root Cause:** Reviewers mistakenly assumed automated Meta WhatsApp Business API bots and HSM templates were required. The user clarified the real-world workflow: organizers export ZIP bundles with sub-folders per Relationship Manager. Each RM receives their guests' raw QR image PNGs and an invitation spreadsheet (with name, phone, ticket URL, and pre-formatted text) to send personally 1-on-1 via WhatsApp.
* **Remediation:**
  1. Remove all automated Meta WhatsApp Business API broadcast / HSM template specifications.
  2. Focus the distribution pipeline on:
     - **Dual-Mode ZIP Export:** Admin exports either a complete flat ZIP or a master ZIP containing individual sub-ZIPs/folders per RM.
     - **RM Sub-Pack Contents:** Each RM folder contains individual attendee QR PNG images (named e.g. `FirstName_LastName_ATT-102.png` encoding raw `ticketCode`) and an `RM_Guest_List.csv` containing Attendee Name, Mobile, Category, Public Pass URL (`https://<domain>/t/:ticketCode`), and a pre-formatted message snippet ready for the RM to copy-paste into personal WhatsApp chats.
     - **Memory-Safe JSZip Generation:** Batch in-browser QR canvas rendering into sequential chunks of 20 with small garbage collection pauses, preventing mobile/laptop heap exhaustion.

---

### 🟡 Majors (High priority architecture & reliability improvements)

#### M1. Multi-Session Offline Schema Alignment & Gate Direction Toggle
* Update Dexie `LocalAttendee` schema to `checkedInSessionIds: string[]` instead of a flat scalar status.
* Add session selection dropdown in `GateLoginModal`.
* Clarify room capacity as pre-allocated quotas or introduce a gate direction toggle (`IN` vs `OUT`).

#### M2. Local Duplicate Validation & Synchronization Clock Skew Safeguard
* Update Section 3.2 Step 2: verify `LocalAttendee.checkedInSessionIds` and pending items in `checkInQueue` before emitting green audio chime offline.
* In Convex schema, record both `clientCapturedAt` and `serverSyncedAt`.
* Calculate client clock drift against Convex server time during gate hydration; warn operator if drift exceeds ±5 seconds.

#### M3. Form Input Exemption in Global Keystroke Interception
* In `src/hooks/useScanner.ts`, ignore keyboard events when `event.target` is an `INPUT`, `TEXTAREA`, or `contenteditable` element.
* On mobile, provide a hidden `<input inputmode="none" tabIndex={-1}>` to safely anchor external hardware OTG scanner keystrokes.

#### M4. Station Pairing Tokens & Passcode Hashing
* Hash `gatePasscode` in the database, or issue individual Station Pairing Tokens from `/admin` with 1-click station revocation.
* Store station tokens in `localStorage`.
* Pre-define gate station names in `events.gates: string[]`.

#### M5. Synchronous Scan Evaluation Branching Logic
* When online (`navigator.onLine === true`), dispatch to Convex with a 250 ms timeout; play green/red AV feedback strictly based on server return.
* When offline, evaluate against local Dexie, emit feedback, and enqueue into `checkInQueue`.

#### M6. VIP Entourage / Spouse Delegations Quick-Admission
* Add optional `groupCode: v.optional(v.string())` and `parentAttendeeId: v.optional(v.id("attendees"))`.
* When a primary pass is scanned, render a 1-tap `[Admit Party of N]` quick action on the gate terminal.

#### M7. CSV Import Column Auto-Mapping & Fallback Normalization
* Document CSV parser column alias mapping (`First Name` / `Given Name`, `Phone` / `Mobile`).
* Normalize phone numbers to E.164. Auto-generate `ticketCode` nanoid and default category to `GENERAL`.

#### M8. Comprehensive Test Plan Coverage
* Add unit test specifications: `tests/unit/csvImport.test.ts`, `tests/unit/rmStats.test.ts`, `tests/unit/rsvp.test.ts`, `tests/unit/exportZip.test.ts`.

---

### 🟢 Nits (Document quality, standards & edge cases)

* **N1:** Add a dedicated `## Risks & Mitigations` section before implementation plan; promote `## Future Improvements` to H2.
* **N2:** Standardize all dividers on `---`; replace subjective terms ("aesthetic", "cannot be guessed") with precise technical descriptions.
* **N3:** Add "Export Reconciled Check-In Audit Log (CSV)" to the admin dashboard and specify post-event data retention guidelines.
* **N4:** Add `ticketStatus: v.union(v.literal("ACTIVE"), v.literal("REVOKED"), v.literal("EXPIRED"))` and `reissueTicketCode` mutation.
* **N5:** Add optional daily RM RSVP alert summaries informing RMs when invited VIPs confirm or decline.
* **N6:** Define name privacy masking heuristics function (`maskName(first, last)`).
* **N7:** Define public ticket 404 card state and allow changing RSVP responses prior to event start.
* **N8:** Document AudioContext first-user-gesture unlock safeguard in gate onboarding.
* **N9:** Add `gates: v.optional(v.array(v.string()))` to `events` table in schema.
* **N10:** Standardize QR code display in ticket page using `QRCode.toDataURL()` in `<img>`.
* **N11:** Assign unreferred attendees to a synthetic `{ referrerName: "Direct / Organic" }` bucket in `getRMStats`.
* **N12:** Pin `tailwindcss: "^3.4.1"` and `postcss: "^8.4.35"` in `package.json`.

---

## 4. Next Steps & Handoff

The review phase under the **Uninterrupted Full Flow** preset is now complete. All 5 individual stage reports and this consolidated synthesis report are persisted to disk.

The next action is to apply these approved remediations directly into `docs/designs/real-time-event-check-in-system.md` to produce the finalized, fully compliant specification ready for implementation.
