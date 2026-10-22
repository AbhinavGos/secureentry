import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { normalizePhoneNumber } from "../lib/csvParser";
import { X, UserPlus, CheckCircle2, Copy, AlertCircle } from "lucide-react";

interface AddAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  inviters: Array<{ _id: string; name: string; email: string }>;
}

export const AddAttendeeModal: React.FC<AddAttendeeModalProps> = ({
  isOpen,
  onClose,
  eventId,
  inviters,
}) => {
  const createAttendeeMutation = useMutation(api.attendees.createAttendee);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [designation, setDesignation] = useState("");
  const [organization, setOrganization] = useState("");
  const [category, setCategory] = useState<"SPONSOR" | "VISITOR" | "VIP" | "ORGANIZER">("VISITOR");
  const [selectedInviterEmail, setSelectedInviterEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPass, setCreatedPass] = useState<{ ticketCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("First Name, Last Name, and Email are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedInviter = inviters.find((inv) => inv.email === selectedInviterEmail);
      const res = await createAttendeeMutation({
        eventId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        contactNumber: normalizePhoneNumber(contactNumber),
        designation: designation.trim() || undefined,
        organization: organization.trim() || undefined,
        category,
        referrerName: selectedInviter?.name || undefined,
        referrerEmail: selectedInviter?.email || undefined,
      });

      setCreatedPass({ ticketCode: res.ticketCode });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create attendee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdPass) return;
    const origin = window.location.origin;
    const path = window.location.pathname.startsWith("/secureentry") ? "/secureentry" : "";
    const passUrl = `${origin}${path}/t/${createdPass.ticketCode}`;
    navigator.clipboard.writeText(passUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setContactNumber("");
    setDesignation("");
    setOrganization("");
    setCategory("VISITOR");
    setSelectedInviterEmail("");
    setCreatedPass(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-wiser-border p-6 sm:p-8 my-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {createdPass ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Invite Created!</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {firstName} {lastName} has been added to the event directory with Pass ID:{" "}
              <code className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {createdPass.ticketCode}
              </code>
            </p>

            <div className="p-4 bg-wiser-bg border border-wiser-border rounded-2xl flex items-center justify-between gap-3 text-left">
              <div className="truncate">
                <span className="text-xs uppercase font-bold text-slate-400 block">Pass URL</span>
                <span className="text-xs font-mono text-slate-700 truncate block">
                  /t/{createdPass.ticketCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2 bg-wiser-navy text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-wiser-navy/90 shrink-0 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? "Copied!" : "Copy Pass Link"}</span>
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 bg-wiser-bg border border-wiser-border text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-100 transition"
              >
                + Add Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-wiser-navy text-white text-sm font-bold rounded-xl hover:bg-wiser-navy/90 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-wiser-navy/10 text-wiser-navy rounded-2xl">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-wiser-navy">Add Event Invitee</h3>
                <p className="text-xs text-slate-500">Manually issue an entry pass to a single guest</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Mehta"
                    className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul.m@example.com"
                  className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Contact Mobile (Auto-formats to +91)
                </label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Founder"
                    className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Organization
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g. Mehta Labs"
                    className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Pass Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm font-semibold"
                  >
                    <option value="VISITOR">VISITOR</option>
                    <option value="VIP">VIP (Gold)</option>
                    <option value="SPONSOR">SPONSOR</option>
                    <option value="ORGANIZER">ORGANIZER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Assigned Inviter (RM)
                  </label>
                  <select
                    value={selectedInviterEmail}
                    onChange={(e) => setSelectedInviterEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm font-medium"
                  >
                    <option value="">Direct / Organic</option>
                    {inviters.map((inv) => (
                      <option key={inv._id} value={inv.email}>
                        {inv.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-wiser-navy text-white text-sm font-bold rounded-xl hover:bg-wiser-navy/90 active:scale-[0.99] transition shadow-md shadow-wiser-navy/20 disabled:opacity-50"
                >
                  {isSubmitting ? "Generating Pass..." : "Create & Issue Entry Pass"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
