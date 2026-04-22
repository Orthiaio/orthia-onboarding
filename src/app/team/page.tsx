"use client";

import { useState } from "react";

export default function TeamGatePage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/team/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Incorrect password");
      }
      window.location.href = "/team/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm">
            <img src="/logo.png" alt="Orthia" className="h-9 w-9 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Orthia <span className="font-light text-slate-300">Team</span>
          </span>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-gray-900">Team access</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter the team password to continue.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>
          <a
            href="/"
            className="mt-4 block text-center text-xs text-gray-400 hover:text-gray-600"
          >
            ← Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
