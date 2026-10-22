import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useScanner } from "../hooks/useScanner";
import { useOfflineSync, ScanEvaluationResult } from "../hooks/useOfflineSync";
import { playSuccessChime, playErrorBuzz } from "../lib/audio";
import { purgeLocalDatabase } from "../lib/db";
import { releaseScreenWakeLock } from "../lib/wakeLock";
import { GateLoginModal } from "../components/GateLoginModal";
import { CameraScannerModal } from "../components/CameraScannerModal";
import { ManualSearchModal } from "../components/ManualSearchModal";
import {
  QrCode,
  Search,
  Camera,
  LogOut,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Radio,
} from "lucide-react";

interface GateSessionState {
  eventId: Id<"events">;
  sessionId: Id<"eventSessions">;
  sessionTitle: string;
  gateId: string;
  operatorName: string;
}

export const GateCheckInPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const event = useQuery(api.events.getEventBySlug, slug ? { slug } : "skip");
  const sessions = useQuery(
    api.eventSessions.listSessionsByEvent,
    event ? { eventId: event._id } : "skip"
  );
  const liveStats = useQuery(
    api.checkIns.getLiveStats,
    event ? { eventId: event._id } : "skip"
  );

  const [sessionState, setSessionState] = useState<GateSessionState | null>(null);
  const [activeCard, setActiveCard] = useState<ScanEvaluationResult | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Restore session from localStorage if already logged in for this slug
  useEffect(() => {
    if (!event) return;
    const cached = localStorage.getItem(`gate_session_${event.slug}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GateSessionState;
        if (parsed.eventId === event._id) {
          setSessionState(parsed);
        }
      } catch {
        localStorage.removeItem(`gate_session_${event.slug}`);
      }
    }
  }, [event]);

  // Hook for offline cache & sync
  const { isOnline, pendingCount, evaluateScan } = useOfflineSync(
    sessionState?.eventId ?? null,
    sessionState?.sessionId ?? null,
    sessionState?.gateId ?? "Gate 1",
    sessionState?.operatorName ?? "Operator"
  );

  // Handle incoming scan (from hardware scanner or camera)
  const handleScan = useCallback(
    async (rawToken: string, source: "SCANNER_HID" | "CAMERA" | "MANUAL" = "SCANNER_HID") => {
      if (!sessionState) return;

      try {
        const result = await evaluateScan(rawToken, source);
        setActiveCard(result);

        if (result.status === "ADMITTED") {
          playSuccessChime();
        } else {
          playErrorBuzz();
        }

        // Auto-dismiss valid card back to standby after 3.2 seconds
        if (result.status === "ADMITTED") {
          setTimeout(() => {
            setActiveCard((prev) => (prev?.passId === result.passId ? null : prev));
          }, 3200);
        }
      } catch (err: unknown) {
        console.error("Scan processing error:", err);
        setActiveCard({
          status: "INVALID_PASS",
          passId: rawToken,
          message: err instanceof Error ? err.message : "Error verifying pass.",
        });
        playErrorBuzz();
      }
    },
    [sessionState, evaluateScan]
  );

  // Register hardware 2D barcode scanner listener
  useScanner({
    onScan: (code) => {
      void handleScan(code, "SCANNER_HID");
    },
    enabled: Boolean(sessionState && !isCameraOpen && !isSearchOpen),
  });

  // Listen for keyboard shortcut '/' to open manual search
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isSearchOpen && !isCameraOpen && sessionState) {
        const target = e.target as HTMLElement | null;
        if (target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA") {
          e.preventDefault();
          setIsSearchOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [isSearchOpen, isCameraOpen, sessionState]);

  // Login handler
  const handleLogin = async (config: {
    passcode: string;
    gateId: string;
    sessionId: string;
    operatorName: string;
  }) => {
    if (!event || !sessions) return { success: false, error: "Event data loading..." };

    if (event.gatePasscode !== config.passcode) {
      return { success: false, error: "Incorrect gate passcode." };
    }

    const matchedSession = sessions.find((s: any) => s._id === config.sessionId) ?? sessions[0];
    const newState: GateSessionState = {
      eventId: event._id,
      sessionId: matchedSession._id,
      sessionTitle: matchedSession.title,
      gateId: config.gateId,
      operatorName: config.operatorName,
    };

    localStorage.setItem(`gate_session_${event.slug}`, JSON.stringify(newState));
    setSessionState(newState);
    return { success: true };
  };

  // Shift logout handler
  const handleLogout = async () => {
    if (event) {
      localStorage.removeItem(`gate_session_${event.slug}`);
    }
    await purgeLocalDatabase();
    await releaseScreenWakeLock();
    setSessionState(null);
    navigate("/");
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wiser-bg text-slate-500">
        Loading event details...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wiser-bg flex flex-col justify-between select-none">
      {/* 1. Shift Login Modal if not logged in */}
      {!sessionState && (
        <GateLoginModal
          eventTitle={event.title}
          gates={event.gates ?? ["Main Gate", "VIP Gate", "East Door"]}
          sessions={sessions ?? []}
          onLogin={handleLogin}
        />
      )}

      {/* 2. Sticky Header Bar */}
      <header className="sticky top-0 z-30 bg-wiser-navy text-white px-4 py-3 sm:px-6 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <QrCode className="w-6 h-6 text-wiser-blue shrink-0" />
          <div className="truncate">
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
              {event.title}
            </h1>
            <span className="text-xs text-wiser-blue font-medium truncate block">
              {sessionState?.sessionTitle} • {sessionState?.gateId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Check-In Counter Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold">
            <span>Checked In:</span>
            <span className="text-wiser-blue">
              {liveStats?.checkedInCount ?? 0} / {liveStats?.totalRegistered ?? 0}
            </span>
          </div>

          {/* Sync Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              isOnline
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline ({pendingCount})</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 3. Central Hero Verification Display */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 max-w-2xl mx-auto w-full">
        {!activeCard ? (
          /* Standby State */
          <div className="w-full bg-white rounded-3xl border border-wiser-border p-8 sm:p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[380px]">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-wiser-blue/20 flex items-center justify-center text-wiser-navy">
                <Radio className="w-10 h-10 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-wiser-navy">
              Ready to Scan
            </h2>
            <p className="text-slate-500 text-base mt-2 max-w-sm">
              Aim 2D barcode scanner at attendee pass or use on-screen camera
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-wiser-bg border border-wiser-border text-xs text-slate-500">
              <span>Press <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300 font-mono text-slate-700">/</kbd> for manual search</span>
            </div>
          </div>
        ) : activeCard.status === "ADMITTED" ? (
          /* Emerald Valid Pass Card (Privacy Sanitized) */
          <div className="w-full bg-emerald-600 text-white rounded-3xl p-8 sm:p-12 text-center shadow-2xl flex flex-col items-center justify-center min-h-[380px] animate-in zoom-in-95 duration-150">
            <CheckCircle2 className="w-20 h-20 text-emerald-200 mb-4" />
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              VALID PASS - ADMIT
            </h2>
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`text-lg font-bold px-4 py-1.5 rounded-full uppercase tracking-wider ${
                  activeCard.category === "VIP"
                    ? "bg-[#D4AF37] text-slate-900 shadow-md"
                    : "bg-white/20 text-white"
                }`}
              >
                {activeCard.category ?? "ATTENDEE"}
              </span>
            </div>
            <div className="mt-4 text-xs font-mono text-emerald-200 tracking-wider">
              PASS ID: {activeCard.passId} {activeCard.isOffline ? "(Saved Offline)" : ""}
            </div>
          </div>
        ) : activeCard.status === "ALREADY_CHECKED_IN" ? (
          /* Crimson Duplicate Alert Card */
          <div className="w-full bg-red-600 text-white rounded-3xl p-8 sm:p-12 text-center shadow-2xl flex flex-col items-center justify-center min-h-[380px] animate-in shake duration-200">
            <AlertOctagon className="w-20 h-20 text-red-200 mb-4 animate-bounce" />
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              ⚠️ ALREADY SCANNED
            </h2>
            <p className="mt-3 text-red-100 text-base max-w-md font-medium">
              {activeCard.message ?? "This pass was already admitted for this session."}
            </p>
            <div className="mt-3 text-xs font-mono text-red-200">
              ID: {activeCard.passId}
            </div>
            <button
              type="button"
              onClick={() => setActiveCard(null)}
              className="mt-6 px-6 py-2.5 bg-white text-red-700 font-bold rounded-xl hover:bg-red-50 active:scale-95 transition text-sm"
            >
              Acknowledge & Dismiss
            </button>
          </div>
        ) : (
          /* Amber Invalid / Restricted Card */
          <div className="w-full bg-amber-500 text-white rounded-3xl p-8 sm:p-12 text-center shadow-2xl flex flex-col items-center justify-center min-h-[380px]">
            <AlertTriangle className="w-20 h-20 text-amber-200 mb-4" />
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              {activeCard.status === "SESSION_RESTRICTED"
                ? "ACCESS RESTRICTED"
                : "INVALID PASS"}
            </h2>
            <p className="mt-3 text-amber-100 text-base max-w-md">
              {activeCard.message ?? "Pass is not recognized in the event directory."}
            </p>
            <button
              type="button"
              onClick={() => setActiveCard(null)}
              className="mt-6 px-6 py-2.5 bg-white text-amber-900 font-bold rounded-xl hover:bg-amber-50 active:scale-95 transition text-sm"
            >
              Dismiss
            </button>
          </div>
        )}
      </main>

      {/* 4. Sticky Bottom Action Dock */}
      <footer className="sticky bottom-0 z-30 bg-white border-t border-wiser-border p-3 sm:p-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex-1 py-3.5 px-4 bg-wiser-bg hover:bg-wiser-border/60 text-wiser-navy font-semibold rounded-xl flex items-center justify-center gap-2 transition active:scale-95 border border-wiser-border text-sm sm:text-base min-h-[48px]"
          >
            <Search className="w-5 h-5 text-wiser-navy" />
            <span>Find Guest (/)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="flex-1 py-3.5 px-4 bg-wiser-navy hover:bg-wiser-navy/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-wiser-navy/10 text-sm sm:text-base min-h-[48px]"
          >
            <Camera className="w-5 h-5 text-wiser-blue" />
            <span>Use Camera</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition shrink-0"
            title="End Shift / Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* Camera Viewfinder Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(token) => {
          setIsCameraOpen(false);
          void handleScan(token, "CAMERA");
        }}
      />

      {/* Manual Search Modal */}
      {sessionState && (
        <ManualSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          eventId={sessionState.eventId}
          sessionId={sessionState.sessionId}
          gateId={sessionState.gateId}
          operatorName={sessionState.operatorName}
          onCheckInSuccess={(category, passId) => {
            setActiveCard({
              status: "ADMITTED",
              category,
              passId,
              isOffline: false,
            });
            playSuccessChime();
          }}
        />
      )}
    </div>
  );
};
