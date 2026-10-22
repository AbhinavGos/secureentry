import React, { useState, useEffect, useRef } from "react";
import { Search, X, UserCheck, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ManualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  sessionId: Id<"eventSessions">;
  gateId: string;
  operatorName: string;
  onCheckInSuccess: (category: string, passId: string) => void;
}

export const ManualSearchModal: React.FC<ManualSearchModalProps> = ({
  isOpen,
  onClose,
  eventId,
  sessionId,
  gateId,
  operatorName,
  onCheckInSuccess,
}) => {
  const [queryTerm, setQueryTerm] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const searchResults = useQuery(
    api.attendees.searchAttendees,
    queryTerm.trim() ? { eventId, queryString: queryTerm } : "skip"
  );

  const recordCheckInMutation = useMutation(api.checkIns.recordCheckIn);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQueryTerm("");
      setActionError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualCheckIn = async (ticketCode: string) => {
    setCheckingInId(ticketCode);
    setActionError(null);

    try {
      const result = await recordCheckInMutation({
        eventId,
        sessionId,
        ticketCode,
        gateId,
        operatorId: gateId,
        operatorName,
        clientCapturedAt: Date.now(),
        source: "MANUAL",
        isOfflineSync: false,
      });

      onCheckInSuccess(result.category ?? "VISITOR", ticketCode);
      onClose();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message.replace("Error: ", "") : "Check-in failed"
      );
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16 sm:pt-24">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-wiser-border overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 p-4 border-b border-wiser-border bg-wiser-bg">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={queryTerm}
            onChange={(e) => setQueryTerm(e.target.value)}
            placeholder="Search by Pass ID, Name, Phone, or Email..."
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-base focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionError && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-wiser-border">
          {!queryTerm.trim() && (
            <div className="py-12 text-center text-sm text-slate-400">
              Type an attendee's name, phone number, or pass ID to look up
            </div>
          )}

          {queryTerm.trim() && searchResults?.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No matching attendees found for "{queryTerm}"
            </div>
          )}

          {searchResults?.map((attendee: any) => {
            const isCheckedIn = attendee.checkInStatus === "CHECKED_IN";
            return (
              <div
                key={attendee._id}
                className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-base">
                      {attendee.firstName} {attendee.lastName}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        attendee.category === "VIP"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {attendee.category}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    ID: <span className="font-mono">{attendee.ticketCode}</span> •{" "}
                    {attendee.contactNumber || attendee.email}
                  </div>
                </div>

                <div>
                  {isCheckedIn ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Admitted
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={checkingInId === attendee.ticketCode}
                      onClick={() => handleManualCheckIn(attendee.ticketCode)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-wiser-navy text-white text-xs font-semibold rounded-lg hover:bg-wiser-navy/90 active:scale-95 transition disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4" />
                      {checkingInId === attendee.ticketCode ? "Admitting..." : "Admit"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
