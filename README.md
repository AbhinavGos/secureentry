# Real-Time Event Check-In System (WiserStack)

A high-reliability, responsive WebAR-adjacent event check-in and attendee management system designed for ~400 attendees across 2–5 entrance gates on PC and mobile devices.

Built with **React 18 + Vite + Tailwind CSS**, **Dexie.js (IndexedDB)** for zero-PII local-first gate check-in, **Convex** for real-time reactive sync and atomic duplicate prevention, and **Zoho CPaaS** for transactional ticket dispatch.

---

## 🚀 Key Highlights & Architectural Decisions

1. **Gate Volunteer Privacy & Zero-PII Storage:**
   - Volunteer terminal screens strictly display: `VALID PASS - ADMIT` / `ALREADY CHECKED IN`, Attendee Category badge (e.g. VIP in Hospitality Gold `#D4AF37`), and Pass ID (e.g. `ATT-409`).
   - Guest names, emails, phone numbers, and company designations are completely omitted from gate volunteer screens and **never stored in local IndexedDB**.
2. **Raw Token QR Codes (No URLs in Scans):**
   - QR codes encode strictly the raw unique 12-char nanoid `ticketCode` (e.g. `V1StGXR8_Z5j`).
   - Ensures minimal optical density, rapid recognition on budget 2D barcode scanners (e.g. Helett HT20 via USB-OTG/Bluetooth), and zero URL parsing overhead.
3. **Dual-Mode Ticket Export (1-on-1 RM WhatsApp Workflow):**
   - **Mode 1 (Flat Archive):** All attendee QR PNGs and a master index CSV.
   - **Mode 2 (Hierarchical RM Sub-Packs):** Partitioned by Relationship Manager into individual folders containing raw QR images and `RM_Guest_List.csv` with pre-formatted WhatsApp invitation snippets for direct 1-on-1 dispatch.
4. **Offline-First Resilience with 350ms Race Timeout:**
   - Check-in queries race the Convex cloud mutation against a 350ms timeout.
   - If the network stalls, the admission is committed locally to Dexie IndexedDB and seamlessly queued for background reconciliation upon reconnect.
5. **Hardware Scanner Integration & Keyboard Exemption:**
   - Global keystroke listener filters hardware bursts (<30ms between keys) while exempting active form `<input>` and `<textarea>` elements so search and authentication typing are never swallowed.

---

## 🎨 WiserStack Brand Palette

- **Primary Navy:** `#002060`
- **Light Brand Blue:** `#BCC0E8`
- **Soft Divider / Border:** `#E8ECF8`
- **Canvas / Background:** `#F5F7FD`
- **Hospitality Gold (Accent / VIP):** `#D4AF37`

---

## 🛠️ Project Structure

```
├── convex/                     # Convex Real-Time Backend
│   ├── schema.ts               # Database schema (events, eventSessions, attendees, checkIns)
│   ├── auth.ts                 # Convex Auth configuration
│   ├── events.ts               # Event CRUD & gate passcode verification
│   ├── eventSessions.ts        # Primary & breakout session management
│   ├── attendees.ts            # Sanitized gate roster, CSV batch import, RSVP & search
│   ├── checkIns.ts             # Atomic check-in mutation & offline sync replay
│   ├── zoho.ts                 # Zoho CPaaS email dispatch action
│   ├── http.ts                 # Webhook ingestion
│   └── crons.ts                # Scheduled reconciliation
│
├── src/
│   ├── lib/
│   │   ├── db.ts               # Dexie.js v1 zero-PII local database
│   │   ├── audio.ts            # Synthetic Web Audio API chime & error buzz
│   │   ├── wakeLock.ts         # Screen Wake Lock API management
│   │   ├── csvParser.ts        # Column auto-mapper & Indian phone normalization
│   │   └── exportZip.ts        # Dual-mode flat & RM sub-pack JSZip bundler
│   ├── hooks/
│   │   ├── useScanner.ts       # Hardware scanner keystroke listener
│   │   └── useOfflineSync.ts   # Hybrid Dexie + Convex check-in hook
│   ├── components/
│   │   ├── GateLoginModal.tsx  # Gate & session selector with audio unlock
│   │   ├── CameraScannerModal.tsx # In-browser camera fallback (@zxing)
│   │   └── ManualSearchModal.tsx  # Keyboard-friendly manual attendee lookup
│   ├── pages/
│   │   ├── GateCheckInPage.tsx # High-contrast gate volunteer terminal
│   │   ├── AdminDashboardPage.tsx # Live counters, RM breakdown & collisions
│   │   ├── AttendeeManagerPage.tsx # CSV roster import & search
│   │   ├── TicketDispatchPage.tsx # Dual-mode ZIP exports & email console
│   │   ├── PublicTicketPage.tsx # Attendee pass with QR & 3-way RSVP
│   │   └── LoginPage.tsx       # Admin authentication
│   ├── App.tsx                 # Client routing
│   └── main.tsx                # App root with Convex provider
│
└── tests/unit/                 # Vitest Unit Test Suites
    ├── csvImport.test.ts       # Column mapping & phone normalization
    ├── useScanner.test.ts      # Keystroke burst timing & form exemption
    └── exportZip.test.ts       # Flat & RM sub-pack structure verification
```

---

## 💻 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Set `VITE_CONVEX_URL` to your Convex deployment URL.

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Unit Tests
```bash
npm test
```

### 5. Build for Production
```bash
npm run build
```
The optimized production bundle will be output to `dist/`.
