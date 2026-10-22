# Intermediate Zoom Out Review Report (Step 8)

**Target:** `docs/designs/real-time-event-check-in-system.md` (`Lines 1-815`)  
**Reviewer Lens:** `egm-zoom-out`  
**Evaluation Standard:** `resources/document_standards/zoom-out-standard.md`  
**Prior Reports Integrated:** `zoom_out_report.md` (Stage 5), `comprehension_report.md` (Stage 6), `critic_report.md` (Stage 7)  
**Output Target:** `intermediate_zoom_out_report.md`

---

## 1. Executive Summary & Whole-Lifecycle Coherence Assessment

Evaluating `docs/designs/real-time-event-check-in-system.md` from the **Intermediate Zoom Out perspective** requires analyzing how the entire system functions as a continuous, end-to-end lifecycle—from initial CSV attendee ingestion through distribution, gate shift onboarding, physical badge scanning, multi-session transit, to post-event teardown and data destruction.

Integrating the granular findings from **Stage 5 (Initial Architecture Audit)**, **Stage 6 (Comprehension & Re-Implementation Test)**, and **Stage 7 (Critic, Structural & Style Audit)** reveals that while individual components (e.g. Web Audio chimes, Dexie.js offline caching, Convex reactive queries) are conceptually attractive, **the system suffers from fundamental systemic disconnects when viewed across its complete operational lifecycle**:

```
[CSV Ingestion] ──> [Media & Link Pipeline] ──> [Gate Station Setup] ──> [Arrival Scanning] ──> [Session Transit] ──> [Teardown & Purge]
     │                       │                          │                       │                      │                     │
  Edge cases &          WhatsApp HSM               Plaintext Passcode &    Unencrypted Local      Monotonic In-Room       Zero retention
  defaults omitted      violations & 50-file       arbitrary volunteer     VIP PII cache on       count lacks exit        lifecycle; VIP
  (Stage 6 #8)          email attachment crash     identity attribution    volunteer phones       decrementing            PII persists on
                        (Stage 5 #2, Stage 7 #4)   (Stage 5 #4)            (Stage 5 #1, 7 #3)     (Stage 5 #3)            phones forever
```

### The Three Core Systemic Tensions:
1. **The Privacy Paradox (Security Theater vs. Storage Reality):** The design places heavy emphasis on gate UI masking (`maskAttendeeDetailsAtGate: true`, `A**** G*******`) to protect VIPs from gate volunteers. Yet the underlying data hydration architecture downloads the unencrypted, full VIP database (personal phones, emails, designations, corporate affiliations, RM referrers) into plaintext browser IndexedDB on those very same volunteers' personal smartphones with zero retention limits or purge mechanisms.
2. **The Distribution Gridlock (Triple-Redundant Over-Engineering vs. Platform Constraints):** The spec specifies three simultaneous distribution mechanisms (client-side JSZip bulk exports, serverless action RM bulk emails with 50 attachments, and dynamic Zoho CPaaS WhatsApp broadcasts). In reality, Meta Business API HSM rules forbid dynamic WhatsApp broadcasts, serverless runtimes timeout and memory-crash on 50 image attachments, and client browsers exhaust heap memory generating 400 canvas QR codes in JSZip.
3. **The Multi-Session Abstraction Gap:** The cloud schema models multi-session check-ins (`checkIns` compound indexed on `[sessionId, attendeeId]`), but the gate login workflow never assigns a session, the Dexie schema only stores a single flat `checkInStatus` string, and in-room capacity tracking is mathematically impossible because there is no exit-scan or checkout mechanism.

---

## 2. Prioritized Findings (Blockers 🔴 -> Major 🟡 -> Nits 🟢)

### 1. Structural Privacy Paradox: Unencrypted VIP PII Hydration on Volunteer Devices Defeats Gate UI Masking - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #1, Stage 7 #3, Stage 6 #10)
* **Affected Scope:** Lines 11–13, 20, 202–206, 216–235, 266–267, 514–519
* **Discrepancy Description:** 
  The core value proposition of the system is protecting VIP attendee confidentiality from temporary gate volunteers and queue onlookers (`maskAttendeeDetailsAtGate: true`). However, Section 3.2 specifies that upon shift entry, the gate station client downloads the complete attendee roster (~200 KB JSON with full names, personal phone numbers, emails, corporate affiliations, designations, and RM referrer names) and writes it into plaintext browser IndexedDB (`Dexie.js`).
  - Anyone opening DevTools or inspecting device storage can dump the entire VIP roster.
  - The local database persists indefinitely on volunteers' personal phones with zero post-event purge routine.
  - The gate UI masking is purely superficial: volunteers have the entire unmasked VIP database sitting unencrypted on their local hardware.
* **Rationale & Recommendation (Under Zoom-Out Standard - Root Cause Focus):**
  A structural fix is required at the data architecture layer, not a UI band-aid:
  1. **Minimal Validation Roster Projection:** When `maskAttendeeDetailsAtGate === true`, the pre-event hydration query (`api.attendees.getRoster`) must return a sanitized projection containing strictly: `{ ticketCode, category, allowedSessionIds, checkInStatus, initials }`. Personal contact numbers, emails, and corporate designations must never be sent to or stored on gate station devices.
  2. **On-Demand Unmasking:** If an operator clicks "Show Details" for manual identity verification, that single record is fetched live from Convex with an audit log entry.
  3. **Mandatory Cache Eviction:** Implement a lifecycle hook `purgeLocalDatabase()` executed automatically upon gate logout, shift end, or when `event.active === false`.

---

### 2. The Distribution Gridlock: WhatsApp Policy Violations, Serverless Memory Crashes, and Email Attachment Limits - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #2, Stage 5 #6, Stage 7 #4, Stage 7 #8, Stage 6 #7)
* **Affected Scope:** Lines 21, 39–40, 92–104, 156–167, 434–467, 598–605
* **Discrepancy Description:**
  The design attempts to solve VIP distribution through three over-engineered, mutually conflicting paths, all of which hit hard platform ceilings:
  1. *WhatsApp Policy Constraint:* Lines 462–466 and 601–604 specify rich textarea template editing with dynamic merge tags for WhatsApp broadcasting via Zoho CPaaS. Meta’s WhatsApp Business API explicitly forbids arbitrary freeform outbound broadcasts; all business-initiated messages mandate pre-approved HSM (Highly Structured Message) templates.
  2. *Serverless Action Crash:* Lines 97–98 and 448–460 specify that Convex action `sendRMInvitePacks` dynamically generates high-resolution PNG QR images for all assigned guests and attaches them to outgoing emails. For an RM handling 40 VIPs, generating 40 image buffers in memory and encoding a 20 MB multipart payload in a single synchronous serverless action exceeds the 60-second execution limit and SMTP/Zoho CPaaS payload limits.
  3. *Client Browser Heap Exhaustion:* Line 437 specifies that client-side JSZip compiles 400 high-res PNG passes in browser memory, triggering browser tab crashes on lower-spec laptops or tablets.
  4. *Human Operational Failure:* Expecting an RM to download 40 individual loose PNG attachments from an email and manually match and forward each image to 40 individual WhatsApp chats under event time-pressure is an operational failure mode that will cause misdirected passes.
* **Rationale & Recommendation (Under Zoom-Out Standard - Simplicity & Minimalist Data Flow):**
  Eliminate the triple-redundant asset generation pipeline and standardize on the **responsive web badge link**:
  1. The canonical distribution artifact is the public ticket URL: `https://<domain>/t/:ticketCode`.
  2. The RM client spreadsheet should contain pre-formatted `https://wa.me/<phone>?text=<encoded_invitation_with_link>` deep-links. RMs can initiate personalized WhatsApp chats with 1 click without downloading or matching loose image files.
  3. Remove heavy in-action image generation from `sendRMInvitePacks`. The email should attach only the lightweight client spreadsheet and provide a secure, authenticated download bundle link (`/rm-download/:token`) for organizers who require offline print archives.
  4. Formally specify the Zoho CPaaS WhatsApp Media Template schema (Utility category, pre-approved document/image header) for automated broadcasts.

---

### 3. Broken Token & Routing Contracts Crippling End-to-End System Ingestion and Execution - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 6 #1, Stage 6 #2, Stage 6 #3, Stage 7 #5)
* **Affected Scope:** Lines 95–96, 101, 156–167, 268, 645–652, 693–696, 729–752
* **Discrepancy Description:**
  The system specification contains critical interface omissions and contract mismatches that break end-to-end execution:
  1. *QR Payload Contract Mismatch (Stage 6 #1):* The public ticket generates a QR code linking to `https://<domain>/t/<ticketCode>`, but the gate scanner performs `attendees.where("ticketCode").equals(code).first()`. When the hardware scanner or camera reads the QR code, it receives the full URL string, causing 100% of valid scans to fail Dexie lookup.
  2. *Missing Application Entrypoint & Routing Manifest (Stage 6 #2):* `package.json` omits `react-router-dom`, and the file manifest omits `src/main.tsx` (React root/Convex provider), `src/App.tsx` (router declaring all 6 pages), and `src/index.css`. The system cannot be built or run.
  3. *Unauthenticated & Undefined Inbound Webhooks (Stage 6 #3, Stage 7 #5):* `POST /zoho-webhook` is exposed without signature verification (`ZOHO_WEBHOOK_SECRET`), allowing spoofed delivery receipts and external database corruption.
* **Rationale & Recommendation:**
  1. Mandate that QR codes encode the canonical URL (`https://<domain>/t/:ticketCode`), and specify that `TokenRouter` / `useScanner` parses incoming strings: if the scan begins with `http://` or `https://`, extract the trailing token segment before querying the database.
  2. Add `react-router-dom` to production dependencies, and add `src/main.tsx`, `src/App.tsx`, and `src/index.css` to the target file manifest in Section 3.
  3. Specify HMAC-SHA256 signature verification in `convex/http.ts` on inbound webhook receipts from Zoho CPaaS.

---

### 4. Broken Multi-Session Abstraction: Monotonic Capacity Bloat & Local Storage Mismatch - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #3, Stage 6 #4, Stage 6 #5)
* **Affected Scope:** Lines 216–235, 258–262, 308–309, 352–367, 477–478, 567, 574, 637–638
* **Discrepancy Description:**
  The system attempts to support multi-session conferences with breakout rooms and room capacities (`sessions.capacity`, Line 308), but the architecture breaks down across three layers:
  1. *Unidirectional Capacity Bloat:* Check-ins are write-only (`checkInStatus: "CHECKED_IN"`). There is no checkout mutation or exit-scan mode. Consequently, "Active In-Session Count" strictly monotonically increases throughout the day, rendering breakout room capacity enforcement impossible once cumulative arrivals exceed room capacity.
  2. *Cloud vs. Local Schema Asymmetry:* Convex scopes check-ins per session via `[sessionId, attendeeId]`. But Dexie's `LocalAttendee` stores only a single scalar `checkInStatus: "CHECKED_IN"`. When an attendee visits Session 1 and later arrives at Session 2 while offline, the local database incorrectly rejects them as already admitted.
  3. *Missing Station Session Binding:* The gate login flow (`GateLoginModal`) prompts for Gate Name and Passcode, but never prompts for or assigns an active `sessionId`.
* **Rationale & Recommendation (Under Zoom-Out Standard - Right Placement):**
  1. Clarify whether `capacity` represents **Total Allocated Badges** or **Real-Time Room Occupancy**. If real-time occupancy is required, introduce a gate direction toggle (`direction: "IN" | "OUT"`). If only access control is required, rename metric to "Cumulative Session Attendance" and enforce capacity as a pre-registration limit.
  2. Update `LocalAttendee` in `src/lib/db.ts` to store `checkedInSessionIds: string[]` instead of a flat scalar status.
  3. Update `GateLoginModal` to require selecting an active session (defaulting to the primary event session).

---

### 5. Offline Gate Security Blind Spot & Unresolved Physical Replay Collisions - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #5, Stage 7 #2, Stage 6 #6)
* **Affected Scope:** Lines 59–66, 82–86, 267–277, 401–405
* **Discrepancy Description:**
  The offline check-in lifecycle contains three compounding security and operational flaws:
  1. *Missing Local Duplicate Validation:* Section 3.2 Step 2 verifies pass existence and session permissions, but omits verifying whether the badge has already been checked into the active session locally. An offline gate operator scanning the same physical badge twice will admit both without error.
  2. *Unmitigated Clock Skew:* Offline sync relies on client device timestamps (`timestamp: number`). Devices in convention center basements frequently have drifted system clocks, corrupting the causal ordering of duplicate scans.
  3. *The Physical Admission Paradox:* When an offline gate reconnects and syncs a collision (`isCollision: true`), the spec states that a non-blocking toast is shown and operations continue. However, in a VIP/high-profile event, an unauthorized duplicate pass holder is now physically inside the venue. A passive toast provides no operational protocol for security intervention.
* **Rationale & Recommendation:**
  1. Add an explicit duplicate check in Section 3.2 Step 2: verify `LocalAttendee.checkedInSessionIds` and pending items in `checkInQueue` before admitting.
  2. Record both `clientCapturedAt` and `serverSyncedAt` in Convex schema, and calculate client clock drift against Convex server time during gate hydration.
  3. Define an authoritative conflict resolution protocol: the first record committed to Convex is authoritative. When an offline collision is committed, trigger a high-priority push notification to the Security Dashboard with the attendee's category and gate location, enabling security personnel to locate the duplicate holder.

---

### 6. Station Identity, Plaintext Passcode Storage, and Audit Trail Corruption - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #4, Stage 7 #7)
* **Affected Scope:** Lines 297, 518, 634–640
* **Discrepancy Description:**
  Gate operators log in using a single static `gatePasscode` shared across all gates (stored in plaintext in `events.gatePasscode`), and type their own operator name into a freeform text input (`Sarah - East Door`).
  - Storing passcodes in plaintext in the database exposes credentials to read queries and export logs.
  - A single shared passcode prevents revoking an individual compromised phone or lost station without kicking all other active gates offline.
  - Any volunteer can type any arbitrary name into the operator input (e.g. "Admin Lead"), corrupting non-repudiation in `checkIns.operatorName` and bypassing audit accountability when clicking "Show Details" on masked VIP records.
* **Rationale & Recommendation:**
  1. Replace the shared static passcode with **Admin-Issued Station Pairing Tokens** (or an Admin QR pairing scan displayed in `/admin` that gate phones scan to pair).
  2. Store station session tokens in `localStorage`, allowing administrators to view active stations in the dashboard and revoke an individual station with 1 click.
  3. Pre-assign gate station names (e.g., Gate 1, Gate 2) during token creation rather than relying on unverified user typing.

---

### 7. Rigid 1:1 Scan Model Ignores VIP Group, Spouse, and Delegation Arrivals - Severity: 🟡 Major
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #7)
* **Affected Scope:** Lines 72–76, 186–188, 216–235, 312–350
* **Discrepancy Description:**
  The check-in engine enforces a strict 1:1 mapping between physical scans and individual attendee records, combined with an 800 ms debounce cooldown.
  - At high-profile summits and galas, VIPs rarely arrive in isolation; they arrive with spouses, executive assistants, security details, or corporate delegations whose invitations are frequently held on a single smartphone.
  - Forcing an operator to repeatedly scan the same phone screen, waiting out the 800 ms debounce each time, while the terminal flashes error states or duplicate alerts, causes queue bottlenecks and VIP friction at the entrance.
* **Rationale & Recommendation:**
  Add an optional `groupCode` or `parentAttendeeId` to `attendees`. When a primary pass is scanned, if linked guests exist, display a prominent quick action on the gate terminal: `[Admit Party of 3 (VIP + 2 Guests)]`, allowing 1-tap admission for the entire entourage.

---

### 8. Post-Event Operational Void: Data Retention, Cache Purging, and Audit Export - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #9, Stage 5 #1)
* **Affected Scope:** Lines 470–485, 526–528, 580–591
* **Discrepancy Description:**
  The design focuses exclusively on live real-time operations, omitting post-event lifecycle procedures:
  - There is no mechanism to export the reconciled check-in audit log (exact arrival timestamps, gate names, operator names, and check-in methods) for CRM ingestion (Zoho CRM / HubSpot).
  - There is no automated teardown policy to purge cached rosters from volunteer devices after the event concludes.
* **Rationale & Recommendation:**
  Add a dedicated "Export Check-In Audit Log (CSV)" action in the admin dashboard and specify a scheduled job that invalidates gate station tokens and triggers local cache destruction once `event.endDate` has passed.

---

### 9. Missing Ticket Invalidation and Re-Issuance Lifecycle - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #8)
* **Affected Scope:** Lines 312–350, 681–684
* **Discrepancy Description:**
  The `attendees` table only maintains `checkInStatus: "REGISTERED" | "CHECKED_IN"`. There is no ticket lifecycle state (`ACTIVE`, `REVOKED`, `TRANSFERRED`). If an attendee leaks their ticket link or loses their phone, organizers cannot invalidate the compromised nanoid without deleting the attendee record entirely.
* **Rationale & Recommendation:**
  Add `ticketStatus: v.union(v.literal("ACTIVE"), v.literal("REVOKED"), v.literal("EXPIRED"))` and a `reissueTicketCode` mutation that generates a fresh nanoid and invalidates the previous token.

---

### 10. Unidirectional Relationship Manager Loop: Missing Real-Time RSVP Alerts - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-zoom-out` (Synthesizing Stage 5 #10)
* **Affected Scope:** Lines 100–104, 416–430, 479–482
* **Discrepancy Description:**
  When a guest updates their RSVP status on `/t/:ticketCode`, Convex updates the admin dashboard, but the Relationship Manager who personally invited the guest receives no notification. RMs driving attendance may send redundant or awkward WhatsApp follow-ups to guests who have already confirmed.
* **Rationale & Recommendation:**
  Provide an optional automated daily or real-time RM notification summary (via email or WhatsApp webhook) informing RMs when their invited VIPs confirm or decline attendance.

---

### 11. Document Hygiene, Structural Alignment, and Style Standards - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-critic` / `egm-structural` (Synthesizing Stage 7 #1, #9, #10, #11)
* **Affected Scope:** Lines 512–539
* **Discrepancy Description:**
  1. The document omits a dedicated `## Risks & Mitigations` section mandated by `feature-spec-standard.md`.
  2. `### Future Improvements` is nested under `## Non-Functional Requirements` instead of standing as an H2 section.
  3. Inconsistent markdown divider syntax (alternating between 80-character dashes and 3-dash dividers).
  4. Subjective marketing copy ("aesthetic invitation", "cannot be guessed or forged").
* **Rationale & Recommendation:**
  Add a dedicated `## Risks & Mitigations` section, promote `## Future Improvements` to H2, standardize on `---` dividers, and adopt objective technical terminology.

---

## 3. End-to-End Systemic Lifecycle Matrix

The table below outlines the end-to-end lifecycle adjustments required to transform the architecture from disjointed components into a robust, compliant production system:

| Lifecycle Phase | Current Design State | Systemic Vulnerability / Bottleneck | Target Architecture Adjustment |
| :--- | :--- | :--- | :--- |
| **1. Pre-Event Ingestion & Asset Prep** | CSV upload with unhandled edge cases; client & serverless binary ZIP image synthesis. | Serverless function timeouts, browser memory crashes, missing defaults in CSV import. | Streamline data flow: generate canonical responsive web ticket URLs (`/t/:ticketCode`); CSV import auto-assigns fallback defaults; pre-render QR SVGs into cloud storage on-demand. |
| **2. Multi-Channel Outreach & RSVP** | Dynamic WhatsApp broadcast via Zoho; RM manual forwarding of 50 loose PNG attachments. | Violates Meta WhatsApp Business HSM rules; extreme RM friction and attachment mismatches. | Use pre-approved WhatsApp HSM media templates; provide pre-built `wa.me` deep-links in RM client spreadsheets for 1-click personal WhatsApp outreach. |
| **3. Gate Onboarding & Station Trust** | Shared plaintext passcode; freeform operator name; full unencrypted VIP PII downloaded to local Dexie. | Zero non-repudiation; cannot revoke compromised phones; VIP data leak under DPDP/GDPR. | Admin-issued Station Pairing Tokens with 1-click revocation; pre-hydrate minimal validation projection (`{ ticketCode, category, allowedSessionIds }`) without PII. |
| **4. Arrival Scanning & Offline Check-In** | Global window key trap; missing local duplicate check in Dexie; clock skew corrupts replay order. | Mobile virtual keyboard swallowed strokes; offline double-scans admitted; timestamp manipulation. | Anchor key trap to hidden `<input inputmode="none">`; check local queue for duplicates before admitting; record `clientCapturedAt` + `serverSyncedAt`. |
| **5. Multi-Session Transit & Breakouts** | Unidirectional check-ins; Dexie single-session scalar status; gate has no session selector. | "Active In-Session Count" monotonic bloat renders room limits impossible; Dexie rejects valid scans. | Update Dexie schema to `checkedInSessionIds: string[]`; bind gate stations to specific sessions; redefine capacity as pre-allocated badge quotas or add exit-scan mode. |
| **6. Teardown, Archival & Purge** | No post-event data lifecycle; volunteer phones keep local database indefinitely. | Regulatory privacy breach; lack of executive reconciliation reporting for CRM sync. | Implement automatic `purgeLocalDatabase()` on shift logout or event deactivation; add 1-click "Export Reconciled Check-In Audit Log (CSV)" to admin dashboard. |

---

## 4. Overall System Verdict & Next Steps

* **Architectural Viability:** **Conditionally Sound with Structural Adjustments.** The core hybrid pairing (Dexie.js IndexedDB + Convex reactive subscriptions + Web Audio synthesis) is the correct architectural choice for sub-second, network-resilient gate check-in.
* **Immediate Blockers to Resolve:**
  1. **Redesign the Local Roster Projection:** Sanitize the offline cache to strip VIP PII, preserving confidentiality while retaining sub-10 ms admission.
  2. **Unify Distribution on Responsive Web URLs:** Replace fragile 50-PNG attachment emails and non-compliant dynamic WhatsApp broadcasts with canonical pass URLs and pre-formatted `wa.me` deep-links.
  3. **Fix Token Parsing & Entrypoint Manifest:** Harmonize the QR payload contract (`https://domain/t/:ticketCode` vs raw token) in `TokenRouter`, and add `react-router-dom`, `src/main.tsx`, and `src/App.tsx` to the implementation plan.
  4. **Align Multi-Session Schema & Workflows:** Add `checkedInSessionIds` to Dexie, bind stations to sessions, and resolve the monotonic room capacity paradox.
