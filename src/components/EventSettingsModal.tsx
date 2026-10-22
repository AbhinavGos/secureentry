import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { normalizePhoneNumber } from "../lib/csvParser";
import {
  X,
  Settings,
  Users,
  Calendar,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface EventSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    _id: Id<"events">;
    title: string;
    slug: string;
    gatePasscode: string;
    gates?: string[];
  };
}

export const EventSettingsModal: React.FC<EventSettingsModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const [activeTab, setActiveTab] = useState<"RMs" | "SESSIONS" | "GATES">("RMs");

  // Queries
  const inviters = useQuery(api.inviters.listInviters, { eventId: event._id });
  const sessions = useQuery(api.eventSessions.listSessionsByEvent, { eventId: event._id });

  // Mutations
  const createInviterMutation = useMutation(api.inviters.createInviter);
  const deleteInviterMutation = useMutation(api.inviters.deleteInviter);
  const createSessionMutation = useMutation(api.eventSessions.createSession);
  const deleteSessionMutation = useMutation(api.eventSessions.deleteSession);
  const updateEventMutation = useMutation(api.events.updateEvent);

  // Form states - Inviter
  const [rmName, setRmName] = useState("");
  const [rmEmail, setRmEmail] = useState("");
  const [rmPhone, setRmPhone] = useState("");
  const [rmDesignation, setRmDesignation] = useState("");
  const [submittingRm, setSubmittingRm] = useState(false);

  // Form states - Session
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionIsPrimary, setSessionIsPrimary] = useState(false);
  const [submittingSession, setSubmittingSession] = useState(false);

  // Form states - Gates & Passcode
  const [passcode, setPasscode] = useState(event.gatePasscode);
  const [newGateName, setNewGateName] = useState("");
  const [updatingGates, setUpdatingGates] = useState(false);

  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  if (!isOpen) return null;

  // Handler: Add RM
  const handleAddInviter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rmName.trim() || !rmEmail.trim()) {
      setStatusMsg({ type: "error", text: "Name and Email are required." });
      return;
    }
    setSubmittingRm(true);
    setStatusMsg(null);
    try {
      await createInviterMutation({
        eventId: event._id,
        name: rmName.trim(),
        email: rmEmail.trim().toLowerCase(),
        phone: normalizePhoneNumber(rmPhone),
        designation: rmDesignation.trim() || undefined,
      });
      setRmName("");
      setRmEmail("");
      setRmPhone("");
      setRmDesignation("");
      setStatusMsg({ type: "success", text: "Relationship Manager added successfully." });
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to add Relationship Manager.",
      });
    } finally {
      setSubmittingRm(false);
    }
  };

  // Handler: Delete RM
  const handleDeleteInviter = async (id: Id<"inviters">) => {
    try {
      await deleteInviterMutation({ id });
      setStatusMsg({ type: "success", text: "Relationship Manager removed." });
    } catch (err: unknown) {
      setStatusMsg({ type: "error", text: "Failed to remove RM." });
    }
  };

  // Handler: Add Session
  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim()) {
      setStatusMsg({ type: "error", text: "Session title is required." });
      return;
    }
    setSubmittingSession(true);
    setStatusMsg(null);
    try {
      await createSessionMutation({
        eventId: event._id,
        title: sessionTitle.trim(),
        location: sessionLocation.trim() || "Main Hall",
        startTime: Date.now(),
        endTime: Date.now() + 14400000,
        isPrimary: sessionIsPrimary,
      });
      setSessionTitle("");
      setSessionLocation("");
      setSessionIsPrimary(false);
      setStatusMsg({ type: "success", text: "Session created successfully." });
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create session.",
      });
    } finally {
      setSubmittingSession(false);
    }
  };

  // Handler: Delete Session
  const handleDeleteSession = async (id: Id<"eventSessions">) => {
    try {
      await deleteSessionMutation({ id });
      setStatusMsg({ type: "success", text: "Session removed." });
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Cannot delete session.",
      });
    }
  };

  // Handler: Update Passcode & Gates
  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingGates(true);
    setStatusMsg(null);
    try {
      const currentGates = event.gates ?? ["Gate 1 (Main Entrance)", "Gate 2 (VIP Pass)"];
      const updatedGates = newGateName.trim()
        ? [...currentGates, newGateName.trim()]
        : currentGates;

      await updateEventMutation({
        id: event._id,
        gatePasscode: passcode.trim(),
        gates: updatedGates,
      });

      setNewGateName("");
      setStatusMsg({ type: "success", text: "Security settings and gates updated." });
    } catch (err: unknown) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update security settings.",
      });
    } finally {
      setUpdatingGates(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-wiser-border p-6 sm:p-8 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-wiser-border">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-wiser-navy/10 text-wiser-navy rounded-2xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-wiser-navy">Event & Inviter Configuration</h3>
              <p className="text-xs text-slate-500">{event.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-wiser-border">
          <button
            type="button"
            onClick={() => {
              setActiveTab("RMs");
              setStatusMsg(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "RMs"
                ? "bg-wiser-navy text-white shadow-sm"
                : "bg-wiser-bg text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Inviters / RMs ({inviters?.length ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("SESSIONS");
              setStatusMsg(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "SESSIONS"
                ? "bg-wiser-navy text-white shadow-sm"
                : "bg-wiser-bg text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Sessions ({sessions?.length ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("GATES");
              setStatusMsg(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
              activeTab === "GATES"
                ? "bg-wiser-navy text-white shadow-sm"
                : "bg-wiser-bg text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Gates & Passcode</span>
          </button>
        </div>

        {/* Status Alert */}
        {statusMsg && (
          <div
            className={`my-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              statusMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab 1: Relationship Managers */}
        {activeTab === "RMs" && (
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {/* Add Inviter Form */}
            <form
              onSubmit={handleAddInviter}
              className="p-4 bg-wiser-bg border border-wiser-border rounded-2xl space-y-3"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-wiser-navy">
                + Add Relationship Manager (Inviter)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={rmName}
                  onChange={(e) => setRmName(e.target.value)}
                  placeholder="Full Name (e.g. Priya Singh)"
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
                <input
                  type="email"
                  required
                  value={rmEmail}
                  onChange={(e) => setRmEmail(e.target.value)}
                  placeholder="Email (e.g. priya@wiserstack.com)"
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
                <input
                  type="tel"
                  value={rmPhone}
                  onChange={(e) => setRmPhone(e.target.value)}
                  placeholder="WhatsApp Mobile (+91...)"
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
                <input
                  type="text"
                  value={rmDesignation}
                  onChange={(e) => setRmDesignation(e.target.value)}
                  placeholder="Designation (e.g. Principal RM)"
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submittingRm}
                className="w-full sm:w-auto px-5 py-2.5 bg-wiser-navy text-white text-xs font-bold rounded-xl hover:bg-wiser-navy/90 active:scale-95 transition disabled:opacity-50"
              >
                {submittingRm ? "Adding..." : "Add Relationship Manager"}
              </button>
            </form>

            {/* List of existing RMs */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Inviters
              </h4>
              {!inviters || inviters.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No custom RMs added yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {inviters.map((inv) => (
                    <div
                      key={inv._id}
                      className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50 transition"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{inv.name}</div>
                        <div className="text-xs text-slate-500">
                          {inv.email} {inv.phone ? `• ${inv.phone}` : ""}{" "}
                          {inv.designation ? `(${inv.designation})` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteInviter(inv._id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                        title="Remove RM"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Sessions */}
        {activeTab === "SESSIONS" && (
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            <form
              onSubmit={handleAddSession}
              className="p-4 bg-wiser-bg border border-wiser-border rounded-2xl space-y-3"
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-wiser-navy">
                + Add Session / Breakout Room
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="Session Title (e.g. VIP Gala Dinner)"
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
                <input
                  type="text"
                  value={sessionLocation}
                  onChange={(e) => setSessionLocation(e.target.value)}
                  placeholder="Room / Hall (e.g. Boardroom 3)"
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="primarySession"
                  checked={sessionIsPrimary}
                  onChange={(e) => setSessionIsPrimary(e.target.checked)}
                  className="rounded border-slate-300 text-wiser-navy focus:ring-wiser-navy"
                />
                <label htmlFor="primarySession" className="text-xs font-medium text-slate-700">
                  Mark as Primary Entry Session
                </label>
              </div>
              <button
                type="submit"
                disabled={submittingSession}
                className="w-full sm:w-auto px-5 py-2.5 bg-wiser-navy text-white text-xs font-bold rounded-xl hover:bg-wiser-navy/90 active:scale-95 transition disabled:opacity-50"
              >
                {submittingSession ? "Creating..." : "Create Session"}
              </button>
            </form>

            {/* List of existing sessions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Configured Event Sessions
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {sessions?.map((s) => (
                  <div
                    key={s._id}
                    className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <span>{s.title}</span>
                        {s.isPrimary && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                            PRIMARY ENTRY
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{s.location}</div>
                    </div>
                    {!s.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s._id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                        title="Remove Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Gates & Passcode */}
        {activeTab === "GATES" && (
          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            <form onSubmit={handleUpdateSecurity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Gate Volunteer Shift Passcode
                </label>
                <input
                  type="text"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm font-mono font-bold text-wiser-navy"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Volunteers enter this 4-digit PIN on mobile/PC to unlock the check-in terminal.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Add Additional Entrance Gate
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGateName}
                    onChange={(e) => setNewGateName(e.target.value)}
                    placeholder="e.g. North Escalator Entrance"
                    className="flex-1 px-4 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm"
                  />
                  <button
                    type="submit"
                    disabled={updatingGates}
                    className="px-5 py-2.5 bg-wiser-navy text-white text-xs font-bold rounded-xl hover:bg-wiser-navy/90 active:scale-95 transition shrink-0"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Current Gates
                </label>
                <div className="flex flex-wrap gap-2">
                  {(event.gates ?? ["Gate 1 (Main Entrance)", "Gate 2 (VIP Pass)"]).map((g) => (
                    <span
                      key={g}
                      className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
