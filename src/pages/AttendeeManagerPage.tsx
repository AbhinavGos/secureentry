import React, { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import Papa from "papaparse";
import { mapCsvRowToAttendee } from "../lib/csvParser";
import {
  Upload,
  ArrowLeft,
  Users,
  Search,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  Copy,
  UserPlus,
} from "lucide-react";
import { AddAttendeeModal } from "../components/AddAttendeeModal";

export const AttendeeManagerPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const event = useQuery(api.events.getEventBySlug, slug ? { slug } : "skip");
  const roster = useQuery(
    api.attendees.getRoster,
    event ? { eventId: event._id } : "skip"
  );
  const inviters = useQuery(
    api.inviters.listInviters,
    event ? { eventId: event._id } : "skip"
  );

  const batchImportMutation = useMutation(api.attendees.batchImportAttendees);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [uploading, setUploading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle CSV file upload & parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;

    setUploading(true);
    setImportStatus(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const parsedAttendees = results.data.map(mapCsvRowToAttendee);

          const res = await batchImportMutation({
            eventId: event._id,
            attendees: parsedAttendees,
          });

          setImportStatus(`Successfully imported ${res.count} attendees!`);
        } catch (err: unknown) {
          setImportStatus(
            `Import failed: ${err instanceof Error ? err.message : "Invalid CSV structure"}`
          );
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (err) => {
        setImportStatus(`CSV parse error: ${err.message}`);
        setUploading(false);
      },
    });
  };

  const copyTicketLink = (ticketCode: string) => {
    const url = `${window.location.origin}/t/${ticketCode}`;
    navigator.clipboard.writeText(url);
    setCopiedId(ticketCode);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wiser-bg text-slate-500">
        Loading attendee directory...
      </div>
    );
  }

  // Filter roster
  const filtered = (roster ?? []).filter((a: any) => {
    const matchesCategory = categoryFilter === "ALL" || a.category === categoryFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term) ||
      (a.contactNumber && a.contactNumber.includes(term)) ||
      (a.referrerName && a.referrerName.toLowerCase().includes(term));
    return matchesCategory && matchesSearch;
  });

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
            <h1 className="text-xl font-bold tracking-tight">Attendee Management</h1>
            <p className="text-xs text-wiser-blue">{event.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs rounded-xl transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Invitee</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-wiser-blue text-wiser-navy font-semibold text-xs rounded-xl hover:bg-white transition shadow-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? "Importing..." : "Upload CSV"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {importStatus && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
              importStatus.startsWith("Successfully")
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {importStatus.startsWith("Successfully") ? (
              <FileCheck className="w-5 h-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            )}
            <span>{importStatus}</span>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-wiser-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by name, phone, email, RM..."
              className="w-full pl-10 pr-4 py-2.5 bg-wiser-bg border border-wiser-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-wiser-navy"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Category:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-wiser-bg border border-wiser-border rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="VIP">VIP</option>
              <option value="SPONSOR">SPONSOR</option>
              <option value="VISITOR">VISITOR</option>
              <option value="ORGANIZER">ORGANIZER</option>
            </select>
          </div>
        </div>

        {/* Attendee Roster Table */}
        <div className="bg-white rounded-2xl border border-wiser-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-wiser-border">
                <tr>
                  <th className="py-3 px-4">Attendee Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Relationship Manager</th>
                  <th className="py-3 px-4">RSVP</th>
                  <th className="py-3 px-4 text-center">Check-In</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wiser-border">
                {filtered.map((att: any) => (
                  <tr key={att._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {att.firstName} {att.lastName}
                      {att.designation && (
                        <span className="block text-xs font-normal text-slate-500">
                          {att.designation} {att.organization ? `at ${att.organization}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          att.category === "VIP"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {att.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div>{att.email}</div>
                      {att.contactNumber && (
                        <div className="text-slate-400 mt-0.5">{att.contactNumber}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {att.referrerName || "Direct / Organic"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          att.rsvpStatus === "YES"
                            ? "bg-emerald-100 text-emerald-800"
                            : att.rsvpStatus === "MAYBE"
                            ? "bg-amber-100 text-amber-800"
                            : att.rsvpStatus === "NO"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {att.rsvpStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {att.checkInStatus === "CHECKED_IN" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Admitted
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not Scanned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => copyTicketLink(att.ticketCode)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-wiser-bg hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-wiser-border transition"
                        title="Copy Public Pass Link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedId === att.ticketCode ? "Copied!" : "Pass Link"}</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      No attendees match your search or filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Manual Invitee Creation Modal */}
      <AddAttendeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        eventId={event._id}
        inviters={inviters ?? []}
      />
    </div>
  );
};
