import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import {
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  Download,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export const PublicTicketPage: React.FC = () => {
  const { ticketCode } = useParams<{ ticketCode: string }>();

  const ticketData = useQuery(
    api.attendees.getPublicTicket,
    ticketCode ? { ticketCode } : "skip"
  );
  const confirmRsvpMutation = useMutation(api.attendees.confirmRsvp);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [rsvpSaved, setRsvpSaved] = useState(false);

  // Generate QR code data URL (encodes strictly the raw token)
  useEffect(() => {
    if (!ticketCode) return;

    QRCode.toDataURL(ticketCode, {
      width: 320,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR generation error:", err));
  }, [ticketCode]);

  const handleRsvp = async (response: "YES" | "NO" | "MAYBE") => {
    if (!ticketCode || submittingRsvp) return;
    setSubmittingRsvp(true);

    try {
      await confirmRsvpMutation({ ticketCode, response });
      setRsvpSaved(true);

      if (response === "YES") {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#002060", "#BCC0E8", "#D4AF37", "#10B981"],
        });
      }
    } catch (err) {
      console.error("RSVP confirmation failed:", err);
    } finally {
      setSubmittingRsvp(false);
    }
  };

  const handleDownloadPass = () => {
    if (!qrDataUrl || !ticketCode) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `Event_Pass_${ticketCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 404 Pass Not Found State
  if (ticketData === null) {
    return (
      <div className="min-h-screen bg-wiser-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-wiser-border text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-wiser-navy">Pass Not Found</h1>
          <p className="text-slate-500 text-sm mt-2">
            The pass code you are attempting to view is invalid or has expired. Please check with your event organizer.
          </p>
        </div>
      </div>
    );
  }

  // Loading State
  if (!ticketData) {
    return (
      <div className="min-h-screen bg-wiser-bg flex items-center justify-center p-4 text-slate-500">
        Loading entry pass...
      </div>
    );
  }

  const { attendee, event } = ticketData;
  const currentRsvp = attendee.rsvpStatus;
  const isVip = attendee.category === "VIP";

  return (
    <div className="min-h-screen bg-wiser-bg py-8 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-wiser-border overflow-hidden">
        {/* Top Header Card */}
        <div className="bg-wiser-navy text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-wiser-blue/10 pointer-events-none" />

          {/* Category Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 shadow-sm bg-white/10 text-white">
            {isVip && <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />}
            <span className={isVip ? "text-[#D4AF37]" : ""}>{attendee.category}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {event.title}
          </h1>

          <div className="mt-4 space-y-1.5 text-xs text-wiser-blue flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 shrink-0 text-white" />
              <span>{new Date(event.startDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 shrink-0 text-white" />
              <span>{new Date(event.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0 text-white" />
              <span>{event.venueName}</span>
            </div>
          </div>
        </div>

        {/* Guest Greeting & QR Code Area */}
        <div className="p-6 sm:p-8 text-center border-b border-wiser-border">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Admit One
          </p>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            {attendee.firstName} {attendee.lastNameMasked}
          </h2>

          {/* Centered QR Pass Image */}
          <div className="mt-6 flex flex-col items-center justify-center">
            <div className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-md inline-block">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR entry pass for ${attendee.firstName}`}
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                  Generating Pass...
                </div>
              )}
            </div>

            <div className="mt-3 text-xs font-mono font-bold text-slate-500 tracking-widest">
              PASS ID: {attendee.ticketCode}
            </div>

            <button
              type="button"
              onClick={handleDownloadPass}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-wiser-navy hover:text-wiser-navy/80 font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save Pass Image to Phone</span>
            </button>
          </div>
        </div>

        {/* 3-Way RSVP Section */}
        <div className="p-6 sm:p-8 bg-wiser-bg/50 text-center">
          {rsvpSaved ? (
            <div className="py-3 px-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-semibold flex items-center justify-center gap-2 animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Thank you! Your response has been recorded.</span>
            </div>
          ) : (
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Will you be joining us?
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Please confirm your attendance for catering and seating arrangements.
              </p>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={submittingRsvp}
                  onClick={() => handleRsvp("YES")}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 active:scale-95 border ${
                    currentRsvp === "YES"
                      ? "bg-wiser-navy text-white border-wiser-navy shadow-sm"
                      : "bg-white text-slate-700 border-wiser-border hover:border-wiser-navy"
                  }`}
                >
                  <span className="text-base">🎉</span>
                  <span>Yes, I'll attend</span>
                </button>

                <button
                  type="button"
                  disabled={submittingRsvp}
                  onClick={() => handleRsvp("MAYBE")}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 active:scale-95 border ${
                    currentRsvp === "MAYBE"
                      ? "bg-wiser-blue text-wiser-navy border-wiser-blue shadow-sm"
                      : "bg-white text-slate-700 border-wiser-border hover:border-wiser-blue"
                  }`}
                >
                  <span className="text-base">🤔</span>
                  <span>Maybe</span>
                </button>

                <button
                  type="button"
                  disabled={submittingRsvp}
                  onClick={() => handleRsvp("NO")}
                  className={`py-3 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 active:scale-95 border ${
                    currentRsvp === "NO"
                      ? "bg-slate-200 text-slate-700 border-slate-300"
                      : "bg-white text-slate-700 border-wiser-border hover:border-slate-400"
                  }`}
                >
                  <span className="text-base">👋</span>
                  <span>Cannot attend</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-slate-400">
        Present this QR pass on your mobile screen upon arrival at the gate
      </div>
    </div>
  );
};
