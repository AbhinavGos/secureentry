import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Users,
  UserCheck,
  CalendarCheck,
  TrendingUp,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ShieldAlert,
  Clock,
  Send,
} from "lucide-react";

export const AdminDashboardPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const event = useQuery(api.events.getEventBySlug, slug ? { slug } : "skip");
  const liveStats = useQuery(
    api.checkIns.getLiveStats,
    event ? { eventId: event._id } : "skip"
  );
  const rmStats = useQuery(
    api.attendees.getRMStats,
    event ? { eventId: event._id } : "skip"
  );
  const recentCheckIns = useQuery(
    api.checkIns.getRecentCheckIns,
    event ? { eventId: event._id, limit: 15 } : "skip"
  );
  const collisions = useQuery(
    api.checkIns.getSecurityCollisions,
    event ? { eventId: event._id } : "skip"
  );
  const roster = useQuery(
    api.attendees.getRoster,
    event ? { eventId: event._id } : "skip"
  );

  // Trigger reconciled CSV export
  const handleExportReconciledLog = () => {
    if (!recentCheckIns || !event) return;

    const headers = ["Timestamp", "Pass ID", "Category", "Gate", "Operator", "Method", "Collision Flag"];
    const rows = recentCheckIns.map((c: any) => [
      new Date(c.timestamp).toISOString(),
      c.ticketCode,
      c.category,
      c.gateId,
      c.operatorName,
      c.source,
      c.isCollision ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${event.slug}_reconciled_checkin_audit.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wiser-bg text-slate-500">
        Loading event operations...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wiser-bg text-slate-900 pb-12">
      {/* Top Navigation Bar */}
      <header className="bg-wiser-navy text-white px-6 py-4 shadow-md sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{event.title}</h1>
          <p className="text-xs text-wiser-blue">
            {event.venueName} • {new Date(event.startDate).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/gate/${event.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-wiser-blue text-wiser-navy font-semibold text-xs rounded-xl hover:bg-white transition"
          >
            <span>Launch Gate Terminal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Action Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-wiser-border shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">Quick Actions:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to={`/admin/events/${event.slug}/attendees`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-wiser-bg hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-wiser-border transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-wiser-navy" />
              <span>Manage Attendees ({roster?.length ?? 0})</span>
            </Link>

            <Link
              to={`/admin/events/${event.slug}/dispatch`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-wiser-navy hover:bg-wiser-navy/90 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Send className="w-4 h-4 text-wiser-blue" />
              <span>Ticket Dispatch & RM Packs</span>
            </Link>

            <button
              type="button"
              onClick={handleExportReconciledLog}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-wiser-border transition"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Audit Log (CSV)</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Total Registered */}
          <div className="bg-white p-5 rounded-2xl border border-wiser-border shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Registered</span>
              <Users className="w-5 h-5 text-wiser-navy" />
            </div>
            <div className="text-3xl font-black text-wiser-navy">
              {liveStats?.totalRegistered ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">Total guests in directory</div>
          </div>

          {/* Card 2: Checked In */}
          <div className="bg-white p-5 rounded-2xl border border-wiser-border shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Checked In</span>
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600">
                {liveStats?.checkedInCount ?? 0}
              </span>
              <span className="text-sm font-bold text-slate-500">
                ({liveStats?.checkedInPercent ?? 0}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${liveStats?.checkedInPercent ?? 0}%` }}
              />
            </div>
          </div>

          {/* Card 3: 3-Way RSVP Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-wiser-border shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">RSVP Status</span>
              <CalendarCheck className="w-5 h-5 text-wiser-blue" />
            </div>
            <div className="flex items-center gap-3 text-sm font-bold">
              <span className="text-emerald-700">Yes: {liveStats?.rsvp.yes ?? 0}</span>
              <span className="text-amber-700">Maybe: {liveStats?.rsvp.maybe ?? 0}</span>
              <span className="text-slate-400">Pending: {liveStats?.rsvp.pending ?? 0}</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Declined: {liveStats?.rsvp.no ?? 0}
            </div>
          </div>

          {/* Card 4: Arrival Velocity */}
          <div className="bg-white p-5 rounded-2xl border border-wiser-border shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Velocity</span>
              <TrendingUp className="w-5 h-5 text-wiser-navy" />
            </div>
            <div className="text-3xl font-black text-wiser-navy">
              {liveStats?.velocityLast15m ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">Arrivals in last 15 mins</div>
          </div>
        </div>

        {/* Relationship Manager Performance & RSVP Breakdown Table */}
        <div className="bg-white rounded-2xl border border-wiser-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-wiser-border bg-wiser-bg flex items-center justify-between">
            <h2 className="text-sm font-bold text-wiser-navy uppercase tracking-wider">
              Relationship Manager (RM) RSVP Performance
            </h2>
            <span className="text-xs text-slate-500">
              {rmStats?.length ?? 0} Managers Assigned
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-wiser-border">
                <tr>
                  <th className="py-3 px-4">Relationship Manager</th>
                  <th className="py-3 px-4 text-center">Assigned</th>
                  <th className="py-3 px-4 text-center text-emerald-700">Confirmed (Yes)</th>
                  <th className="py-3 px-4 text-center text-amber-700">Maybe</th>
                  <th className="py-3 px-4 text-center text-red-600">Declined</th>
                  <th className="py-3 px-4 text-center text-slate-500">Pending</th>
                  <th className="py-3 px-4 text-center text-wiser-navy">Door Check-In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wiser-border">
                {rmStats?.map((rm: any) => (
                  <tr key={rm.referrerEmail} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {rm.referrerName}
                      <span className="block text-xs font-normal text-slate-400">
                        {rm.referrerEmail}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {rm.totalAssigned}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      {rm.confirmedYes}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-600">
                      {rm.maybe}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {rm.declinedNo}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-500">
                      {rm.pending}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-wiser-navy">
                      {rm.checkedIn}
                    </td>
                  </tr>
                ))}
                {(!rmStats || rmStats.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-sm text-slate-400">
                      No Relationship Manager assignments recorded in the attendee roster.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Two-Column Grid: Live Arrival Feed & Security Collision Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Arrival Stream (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-wiser-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-wiser-border bg-wiser-bg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-wiser-navy" />
                <h3 className="text-sm font-bold text-wiser-navy uppercase tracking-wider">
                  Live Arrival Feed
                </h3>
              </div>
              <span className="text-xs text-slate-400">Reactive WebSocket Stream</span>
            </div>

            <div className="divide-y divide-wiser-border max-h-[380px] overflow-y-auto">
              {recentCheckIns?.map((item: any) => (
                <div
                  key={item._id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        item.category === "VIP"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.category}
                    </span>
                    <div>
                      <div className="text-xs font-mono font-semibold text-slate-800">
                        Pass ID: {item.ticketCode}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.gateId} • by {item.operatorName} ({item.source})
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))}

              {(!recentCheckIns || recentCheckIns.length === 0) && (
                <div className="py-12 text-center text-sm text-slate-400">
                  Waiting for incoming scans...
                </div>
              )}
            </div>
          </div>

          {/* Security & Collision Alert Table (1 col) */}
          <div className="bg-white rounded-2xl border border-wiser-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-wiser-border bg-red-50/50 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider">
                Security & Collisions
              </h3>
            </div>

            <div className="divide-y divide-wiser-border max-h-[380px] overflow-y-auto">
              {collisions?.map((col: any) => (
                <div key={col._id} className="p-3.5 bg-red-50/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-700">
                      DUPLICATE SCAN ATTEMPT
                    </span>
                    <span className="text-xs text-red-500">
                      {new Date(col.serverSyncedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 mt-1 font-mono">
                    Pass: {col.ticketCode} ({col.category})
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Gate: {col.gateId} • Op: {col.operatorName}
                  </div>
                </div>
              ))}

              {(!collisions || collisions.length === 0) && (
                <div className="py-12 text-center text-xs text-slate-400">
                  No duplicate scans or offline collisions recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
