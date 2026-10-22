import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { exportAllAttendeesZip, exportRMSubPacksZip } from "../lib/exportZip";
import {
  ArrowLeft,
  Download,
  FolderArchive,
  MessageCircle,
  Mail,
  Send,
  CheckCircle2,
  FileText,
} from "lucide-react";

export const TicketDispatchPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const event = useQuery(api.events.getEventBySlug, slug ? { slug } : "skip");
  const roster = useQuery(
    api.attendees.getRoster,
    event ? { eventId: event._id } : "skip"
  );

  const [activeTab, setActiveTab] = useState<"RM_ZIP" | "EMAIL">("RM_ZIP");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState<string | null>(null);

  // Email template draft state
  const [emailSubject, setEmailSubject] = useState(
    `Your Entry Pass for ${event?.title ?? "Event"}`
  );
  const [emailBody, setEmailBody] = useState(
    `Dear {firstName},\n\nYou are cordially invited to {eventName}.\n\nPlease view your personalized entry pass and confirm attendance here:\n{ticketLink}\n\nWe look forward to welcoming you.`
  );
  const [recipientFilter, setRecipientFilter] = useState("ALL");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const dispatchBatch = useAction(api.zoho.dispatchTicketBatch);
  const sendTestEmail = useAction(api.zoho.sendTestEmail);

  const [testRecipient, setTestRecipient] = useState("hello@digicount.ai");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);

  const handleSendTestEmail = async () => {
    if (!testRecipient) return;
    setSendingTest(true);
    setTestResultMsg(null);
    try {
      const res = await sendTestEmail({
        toEmail: testRecipient,
        subject: `Live Test Verification - ${event?.title ?? "WiserStack SecureEntry"}`,
      });
      if (res.success) {
        setTestResultMsg(`Success! Live test email sent to ${testRecipient} via Zoho CPaaS.`);
      } else {
        setTestResultMsg("Dispatched with warnings.");
      }
    } catch (err: any) {
      setTestResultMsg(`Error sending test email: ${err?.message || String(err)}`);
    } finally {
      setSendingTest(false);
    }
  };

  const handleExportFlat = async () => {
    if (!roster || !event) return;
    setExporting(true);
    setProgress(0);
    setExportComplete(null);

    try {
      await exportAllAttendeesZip(roster, event.slug, (p) => setProgress(p));
      setExportComplete("Flat QR code bundle downloaded successfully!");
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportRMPacks = async () => {
    if (!roster || !event) return;
    setExporting(true);
    setProgress(0);
    setExportComplete(null);

    try {
      await exportRMSubPacksZip(roster, event.slug, event.title, (p) => setProgress(p));
      setExportComplete("RM WhatsApp sub-packs archive downloaded successfully!");
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleSendEmailBatch = async () => {
    if (!event) return;
    setSendingEmail(true);
    setEmailStatus("Dispatching ticket invitations via Zoho CPaaS...");

    try {
      const res = await dispatchBatch({
        eventId: event._id,
        subject: emailSubject,
        templateBody: emailBody,
        recipientCategory: recipientFilter,
      });

      if (res.simulated) {
        setEmailStatus(
          `Simulated dispatch for ${res.count} recipient(s). Set ZOHO_CPAAS_API_KEY in Convex to send live emails.`
        );
      } else if (res.success) {
        setEmailStatus(`Successfully dispatched ${res.count} ticket invitation(s) via Zoho CPaaS!`);
      } else {
        setEmailStatus(
          `Dispatched ${res.count} successfully, ${res.failed} failed. Check console for details.`
        );
      }
    } catch (err: any) {
      console.error("Zoho email dispatch error:", err);
      setEmailStatus(`Failed to dispatch: ${err.message || String(err)}`);
    } finally {
      setSendingEmail(false);
    }
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wiser-bg text-slate-500">
        Loading ticket dispatch...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wiser-bg text-slate-900 pb-12">
      <header className="bg-wiser-navy text-white px-6 py-4 shadow-md sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/admin/events/${event.slug}`}
            className="p-1 rounded-lg text-wiser-blue hover:text-white hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Ticket Dispatch & RM Packs</h1>
            <p className="text-xs text-wiser-blue">{event.title}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-wiser-border pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("RM_ZIP")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
              activeTab === "RM_ZIP"
                ? "bg-wiser-navy text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-wiser-border"
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>RM Sub-Packs & ZIP Exports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("EMAIL")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
              activeTab === "EMAIL"
                ? "bg-wiser-navy text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-wiser-border"
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Zoho CPaaS Email Dispatch</span>
          </button>
        </div>

        {/* Tab 1: RM Sub-Packs & Dual Mode ZIP Export */}
        {activeTab === "RM_ZIP" && (
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-wiser-border shadow-sm">
              <h2 className="text-lg font-bold text-wiser-navy mb-1">
                Relationship Manager (RM) WhatsApp Outreach Packs
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Generate and download high-resolution QR pass archives for 1-on-1 personal distribution via WhatsApp.
              </p>

              {exporting && (
                <div className="mb-6 p-4 bg-wiser-bg border border-wiser-border rounded-xl">
                  <div className="flex items-center justify-between text-xs font-semibold text-wiser-navy mb-2">
                    <span>Rendering raw-token QR badges in browser memory...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-wiser-navy h-full rounded-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {exportComplete && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{exportComplete}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: RM Sub-Packs */}
                <div className="p-5 border border-wiser-border rounded-2xl bg-wiser-bg/50 hover:bg-white hover:border-wiser-blue transition flex flex-col justify-between">
                  <div>
                    <div className="inline-flex p-2.5 rounded-xl bg-wiser-navy text-wiser-blue mb-3">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Grouped by RM (Sub-Packs)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Creates a master ZIP with individual folders for each Relationship Manager. Each folder contains individual guest QR PNGs and an <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">RM_Guest_List.csv</code> with pre-formatted WhatsApp invite snippets.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={exporting || !roster?.length}
                    onClick={handleExportRMPacks}
                    className="mt-6 w-full py-3 bg-wiser-navy text-white text-xs font-bold rounded-xl hover:bg-wiser-navy/90 active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download RM Sub-Packs (ZIP)</span>
                  </button>
                </div>

                {/* Option 2: All Attendees Flat Bundle */}
                <div className="p-5 border border-wiser-border rounded-2xl bg-wiser-bg/50 hover:bg-white hover:border-wiser-blue transition flex flex-col justify-between">
                  <div>
                    <div className="inline-flex p-2.5 rounded-xl bg-slate-200 text-slate-700 mb-3">
                      <FolderArchive className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">
                      All Attendees (Single Dump)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Flat archive of all attendee QR PNGs named by ID and name, along with a master <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">attendees_master_index.csv</code> with public pass URLs.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={exporting || !roster?.length}
                    onClick={handleExportFlat}
                    className="mt-6 w-full py-3 bg-white border border-wiser-border text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>Download Complete Archive (ZIP)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Explanatory 1-on-1 Workflow Card */}
            <div className="bg-white p-6 rounded-2xl border border-wiser-border shadow-sm flex items-start gap-4">
              <FileText className="w-6 h-6 text-wiser-navy shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600 leading-relaxed">
                <h4 className="font-bold text-slate-900 mb-1">Human 1-on-1 WhatsApp Workflow:</h4>
                Relationship Managers receive their individual sub-folder containing their guests' raw-token QR images and a spreadsheet. The RM opens WhatsApp on mobile or PC, copies the pre-formatted invite text, attaches the guest's QR image, and sends it directly on a personal 1-on-1 basis.
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Direct Zoho CPaaS Email Broadcast */}
        {activeTab === "EMAIL" && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-wiser-border shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-wiser-navy mb-1">
                Transactional Ticket Email Dispatch
              </h2>
              <p className="text-sm text-slate-500">
                Send personalized invitations with unique entry pass links directly to attendees.
              </p>
            </div>

            {/* Quick Test Email Verification Card */}
            <div className="p-4 bg-slate-50 border border-wiser-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-wiser-navy">
                  Zoho CPaaS Single-Recipient Test
                </span>
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
                  Credentials Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Dispatch an immediate test email to verify domain authorization and SPF/DKIM delivery before batch blasting.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Recipient Email (e.g. hello@digicount.ai)"
                  className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                />
                <button
                  type="button"
                  disabled={sendingTest || !testRecipient}
                  onClick={handleSendTestEmail}
                  className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 active:scale-95 disabled:opacity-50 transition shrink-0"
                >
                  {sendingTest ? "Sending Test..." : "Send Live Test Email"}
                </button>
              </div>
              {testResultMsg && (
                <div className={`p-2.5 rounded-lg text-xs font-medium ${testResultMsg.startsWith("Success") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                  {testResultMsg}
                </div>
              )}
            </div>

            {emailStatus && (
              <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-medium">
                {emailStatus}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Recipient Audience
                </label>
                <select
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  className="w-full sm:w-64 px-4 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm font-medium"
                >
                  <option value="ALL">All Registered Attendees ({roster?.length ?? 0})</option>
                  <option value="VIP">VIP Guests Only</option>
                  <option value="UNCONFIRMED">Pending RSVP Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Email Body (Supports dynamic chips: &#123;firstName&#125;, &#123;eventName&#125;, &#123;ticketLink&#125;)
                </label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full p-4 bg-wiser-bg border border-wiser-border rounded-xl text-sm font-mono leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={handleSendEmailBatch}
                disabled={sendingEmail}
                className="inline-flex items-center gap-2 px-6 py-3 bg-wiser-navy text-white text-sm font-bold rounded-xl hover:bg-wiser-navy/90 active:scale-95 disabled:opacity-50 transition shadow-md shadow-wiser-navy/15"
              >
                <Send className="w-4 h-4 text-wiser-blue" />
                <span>{sendingEmail ? "Dispatching..." : "Dispatch Ticket Batch via Zoho CPaaS"}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
