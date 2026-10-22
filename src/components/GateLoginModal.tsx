import React, { useState } from "react";
import { Lock, DoorOpen, User, KeyRound, AlertCircle } from "lucide-react";
import { unlockAudio } from "../lib/audio";
import { requestScreenWakeLock } from "../lib/wakeLock";

interface GateLoginModalProps {
  eventTitle: string;
  gates: string[];
  sessions: { _id: string; title: string; isPrimary: boolean }[];
  onLogin: (config: {
    passcode: string;
    gateId: string;
    sessionId: string;
    operatorName: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const GateLoginModal: React.FC<GateLoginModalProps> = ({
  eventTitle,
  gates,
  sessions,
  onLogin,
}) => {
  const [passcode, setPasscode] = useState("");
  const [selectedGate, setSelectedGate] = useState(gates[0] ?? "Gate 1");
  const [selectedSession, setSelectedSession] = useState(
    sessions.find((s) => s.isPrimary)?._id ?? sessions[0]?._id ?? ""
  );
  const [operatorName, setOperatorName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError("Please enter the gate passcode.");
      return;
    }
    if (!operatorName.trim()) {
      setError("Please enter your display name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Unlock Web Audio API & request Screen Wake Lock on user gesture
      await unlockAudio();
      await requestScreenWakeLock();

      // 2. Validate passcode with backend
      const res = await onLogin({
        passcode: passcode.trim(),
        gateId: selectedGate,
        sessionId: selectedSession,
        operatorName: operatorName.trim(),
      });

      if (!res.success) {
        setError(res.error ?? "Invalid passcode. Please verify with event organizer.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initialize gate.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-wiser-border p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-wiser-navy/10 text-wiser-navy mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-wiser-navy">Gate Station Login</h2>
          <p className="text-sm text-slate-500 mt-1">{eventTitle}</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Event Passcode
            </label>
            <div className="relative">
              <KeyRound className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter gate passcode"
                className="w-full pl-10 pr-4 py-3 bg-wiser-bg border border-wiser-border rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-wiser-navy text-base"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Select Gate
            </label>
            <div className="relative">
              <DoorOpen className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedGate}
                onChange={(e) => setSelectedGate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-wiser-bg border border-wiser-border rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-wiser-navy text-base appearance-none cursor-pointer"
              >
                {gates.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Active Room / Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-4 py-3 bg-wiser-bg border border-wiser-border rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-wiser-navy text-base cursor-pointer"
            >
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title} {s.isPrimary ? "(Primary)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Operator Display Name
            </label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="e.g. Sarah - East Door"
                className="w-full pl-10 pr-4 py-3 bg-wiser-bg border border-wiser-border rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-wiser-navy text-base"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-wiser-navy text-white font-semibold rounded-xl hover:bg-wiser-navy/90 active:scale-[0.99] transition shadow-lg shadow-wiser-navy/20 disabled:opacity-50 text-lg"
          >
            {loading ? "Initializing..." : "Enter Gate & Start Scanning"}
          </button>
        </form>
      </div>
    </div>
  );
};
