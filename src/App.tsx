import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { GateCheckInPage } from "./pages/GateCheckInPage";
import { PublicTicketPage } from "./pages/PublicTicketPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AttendeeManagerPage } from "./pages/AttendeeManagerPage";
import { TicketDispatchPage } from "./pages/TicketDispatchPage";

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/gate/:slug" element={<GateCheckInPage />} />
      <Route path="/t/:ticketCode" element={<PublicTicketPage />} />

      {/* Admin routes */}
      <Route path="/admin/events/:slug" element={<AdminDashboardPage />} />
      <Route path="/admin/events/:slug/attendees" element={<AttendeeManagerPage />} />
      <Route path="/admin/events/:slug/dispatch" element={<TicketDispatchPage />} />

      {/* Default fallback */}
      <Route path="/" element={<Navigate to="/admin/events/wiserstack-conclave-2026" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
