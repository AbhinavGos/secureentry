import React, { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Lock, Mail, ShieldAlert, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const LoginPage: React.FC = () => {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn("password", { email, password, flow: "signIn" });
      navigate("/admin/events");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-wiser-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-wiser-border p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-wiser-navy text-wiser-blue mb-4 shadow-lg shadow-wiser-navy/15">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-wiser-navy">Organizer Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to manage events, attendees, and live arrival streams
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@wiserstack.com"
                className="w-full pl-11 pr-4 py-3 bg-wiser-bg border border-wiser-border rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-wiser-navy text-base"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-11 pr-4 py-3 bg-wiser-bg border border-wiser-border rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-wiser-navy text-base"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-wiser-navy text-white font-semibold rounded-xl hover:bg-wiser-navy/90 active:scale-[0.99] transition shadow-md shadow-wiser-navy/20 flex items-center justify-center gap-2 disabled:opacity-50 text-base"
          >
            <span>{loading ? "Signing in..." : "Sign In"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
