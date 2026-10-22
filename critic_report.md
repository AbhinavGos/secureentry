# Goldfish Review Report: Step 7 Critic Review

**Target:** `docs/designs/real-time-event-check-in-system.md` (`Lines 1-539`)  
**Evaluation Standard:** `resources/document_standards/feature-spec-standard.md`  
**Reviewers:** `egm-design`, `egm-structural`, `egm-style`  
**Output Target:** `critic_report.md`

### Summary Breakdown
* 🔴 **Blocker:** 3
* 🟡 **Major:** 5
* 🟢 **Nit:** 3
* **Total Findings:** 11

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 1. Missing Mandatory "Risks & Mitigations" Section - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-structural` / `egm-design`
* **Affected Scope:** Lines 512–531 (`## Non-Functional Requirements`)
* **Discrepancy Description**: The document completely omits a dedicated `## Risks & Mitigations` section. While non-functional requirements and resolved architectural questions are present, `feature-spec-standard.md` strictly mandates an explicit evaluation of constraints, failure modes, security risks, scalability limits, and concrete mitigations.
* **Rationale & Recommendation**: Add a dedicated `## Risks & Mitigations` section prior to the detailed implementation plan. Systematically analyze key failure modes (e.g., offline concurrent gate collisions, browser memory exhaustion during bulk export, mobile IME keystroke drops, email dispatch rate limiting) and document their respective architectural safeguards.

### 2. Unmitigated Clock Skew & Authoritative Conflict Resolution in Offline Replay - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 59–66, Lines 82–86 (`CUJ 3`), Lines 271–277 (`Section 3.2`), Lines 401–405 (`Section 4.1`)
* **Discrepancy Description**: Offline queued check-ins rely on the client device timestamp (`timestamp: number`) for chronological replay. If a gate device clock is inaccurate, drifting, or manipulated, the replay ordering and audit trail are corrupted. Furthermore, the spec notes that replayed duplicate scans are marked with `isCollision: true` without resolving the physical security paradox: if Attendee A entered at Gate 1 (offline, 10:00 AM) and an imposter entered at Gate 2 (online, 10:05 AM), replaying Gate 1's scan at 10:15 AM cannot retroactively un-admit either attendee.
* **Rationale & Recommendation**:
  1. Record both `clientTimestamp` and `serverReceivedAt` in Convex schema to prevent timestamp spoofing.
  2. Implement an initial time-sync check during gate hydration: calculate delta between client clock and Convex server time, alerting if drift exceeds ±5 seconds.
  3. Formally specify conflict semantics: the first record committed to Convex is authoritative; offline replayed duplicates trigger a high-priority push alert to the security dashboard without revoking local gate operation.

### 3. Insecure Local Caching of VIP PII in Gate IndexedDB - Severity: 🔴 Blocker
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 11–13, Lines 20, Lines 216–235 (`Section 3.1`), Lines 266–267 (`Section 3.2`)
* **Discrepancy Description**: A foundational premise of the system is protecting VIP attendee privacy from temporary gate volunteers and onlookers by masking screen details (`maskAttendeeDetailsAtGate: true`). However, Section 3 hydrates the complete attendee roster—including `firstName`, `lastName`, `email`, `contactNumber`, `designation`, `organization`, and raw `ticketCode`—into browser IndexedDB (`Dexie.js`) on the volunteer's personal or shared device. Anyone with access to browser developer tools or storage inspect tools can extract the entire unencrypted VIP guest list.
* **Rationale & Recommendation**:
  1. When `maskAttendeeDetailsAtGate` is enabled for an event, restrict pre-hydrated offline roster fields to non-sensitive validation tokens: `ticketCodeHash`, `category`, `allowedSessionIds`, and `checkInStatus` (stripping contact numbers, emails, and designations from gate station cache).
  2. Alternatively, encrypt the local Dexie store using an encryption key derived from the gate passcode, or explicitly document physical device custody and ephemeral storage boundaries as an accepted operational constraint.

### 4. Serverless Memory & Timeout Ceilings for In-Action Bulk QR Generation & Email Dispatch - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 448–461 (`Section 5.2`), Lines 156–157 (`Section 1`)
* **Discrepancy Description**: Section 5.2 defines that clicking "Send Invite Packs to RMs" triggers a single Convex action (`sendRMInvitePacks` in `convex/zoho.ts`) that synchronously generates high-resolution PNG QR images, compiles client spreadsheets, and dispatches emails with multiple attachments for all assigned guests. In serverless runtimes with 2-minute execution limits and memory boundaries, generating hundreds of image attachments and dispatching multi-megabyte payloads in one synchronous action risks timeout aborts and memory exhaustion.
* **Rationale & Recommendation**: Refactor `sendRMInvitePacks` into a scheduled queue pattern using `ctx.scheduler.runAfter` to dispatch packs asynchronously per RM. Pre-generate QR badge images and persist them in Convex file storage, attaching or linking CDN assets rather than synthesizing raw binary buffers in-memory during email composition.

### 5. Unauthenticated Public Inbound Webhook (`/zoho-webhook`) - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 158–160 (`Section 1`), Lines 377–396, Lines 466–467 (`Section 5.3`)
* **Discrepancy Description**: Section 1 and Section 5.3 expose an HTTP endpoint (`/zoho-webhook`) that writes delivery statuses directly to `deliveryLogs`. The specification does not define any authentication, signature validation, or rate-limiting mechanism. Any external entity can forge delivery receipts or flood the database with bogus webhook payloads.
* **Rationale & Recommendation**: Specify cryptographic signature verification (e.g., verifying Zoho CPaaS HMAC-SHA256 signature header against a secret environment variable `ZOHO_WEBHOOK_SECRET`) and reject unauthenticated requests with HTTP 401.

### 6. Fragility of Focus-Free Global Keystroke Capture on Mobile OS/IME - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 174–188 (`Section 2.1 useScanner`)
* **Discrepancy Description**: Section 2.1 specifies capturing HID 2D barcode scanner keystrokes via a window-level listener without an active HTML `<input>`. On mobile browsers (Chrome/Safari on Android/iOS), external USB/Bluetooth keyboard inputs outside an active input element can be swallowed by the OS, buffered into uncommitted composition strings (`compositionupdate`), or filtered by software keyboard IMEs (e.g., Gboard).
* **Rationale & Recommendation**: Specify the Android/iOS DOM integration safeguard: implement a hidden, off-screen `<input inputmode="none" tabIndex={-1}>` that captures raw input without invoking the software virtual keyboard, and explicitly note supported OS and browser baselines.

### 7. Plaintext Gate Passcode Storage in Database Schema - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 297 (`Section 4 Schema`), Lines 518 (`Security & Privacy`)
* **Discrepancy Description**: In `convex/schema.ts`, the `events` table defines `gatePasscode: v.string()`. Storing gate operator passcodes in plaintext in the database exposes shift access credentials to database read queries, export dumps, or administrative leaks.
* **Rationale & Recommendation**: Hash the `gatePasscode` using bcrypt/Argon2 or PBKDF2 before storing, or authenticate gate operators via short-lived signed session tokens issued by an administrative Convex mutation.

### 8. Client Browser Heap Exhaustion on 400-Pass JSZip Generation - Severity: 🟡 Major
* **Reviewer Lens:** `egm-design`
* **Affected Scope:** Lines 437–446 (`Section 5.1`)
* **Discrepancy Description**: Section 5.1 specifies generating high-resolution PNG QR images for 400 attendees and packing them into hierarchical ZIP archives (flat or per-RM) on the client side using JSZip (`src/lib/exportZip.ts`). Rendering 400 high-resolution HTML5 canvas elements and holding hundreds of uncompressed image blobs in browser heap memory can easily trigger tab crashes on mobile devices or low-spec laptops.
* **Rationale & Recommendation**: Batch canvas generation sequentially in chunks of 20 with explicit garbage collection pauses, or delegate heavy ZIP archive compilation to a server-side Convex action / cloud worker.

### 9. Structural Heading Level Misalignment (`### Future Improvements`) - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 532–537
* **Discrepancy Description**: `### Future Improvements` is formatted as an H3 subsection nested directly under `## Non-Functional Requirements`, rather than standing as a top-level H2 section.
* **Rationale & Recommendation**: Promote `### Future Improvements` to a top-level `## Future Improvements` (H2) heading.

### 10. Subjective Aesthetic Phrasing & Absolute Claims - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-style`
* **Affected Scope:** Lines 13, 42, 100, 102, 508, 526
* **Discrepancy Description**: The specification uses subjective marketing terminology ("aesthetic public invitation", "aesthetic invitation", "intuitive, minimalist UI") and absolute ungrounded assertions ("tokens that cannot be guessed or forged", "Network Degradation Immunity").
* **Rationale & Recommendation**:
  - Replace "aesthetic invitation" with "responsive, branded public invitation".
  - Replace "cannot be guessed or forged" with "provides ~71 bits of entropy, preventing brute-force guessing".
  - Replace "Network Degradation Immunity" with "Offline Network Tolerance".

### 11. Inconsistent Markdown Horizontal Divider Syntax - Severity: 🟢 Nit
* **Reviewer Lens:** `egm-structural`
* **Affected Scope:** Lines 7, 15, 28, 45, 170, 208, 278, 432, 468, 510, 530, 538
* **Discrepancy Description**: The document alternates between 80-character dashed lines (`--------------------------------------------------------------------------------`) and standard 3-dash dividers (`---`).
* **Rationale & Recommendation**: Standardize on a single divider syntax (`---`) throughout the entire document.
