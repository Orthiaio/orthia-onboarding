"use client";

import { useState } from "react";

export default function Home() {
  const [clinicName, setClinicName] = useState("");
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicName.trim()) return;

    setResearching(true);
    setError("");

    try {
      const res = await fetch("/api/self-serve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName: clinicName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Something went wrong");
      }

      const data = await res.json();
      window.location.href = data.link;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setResearching(false);
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Streamline Your Practice Onboarding
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-blue-100">
            Get started in under 2 minutes. We'll automatically look up your
            practice details so you only need to confirm and fill in the rest.
          </p>

          {/* Self-serve form */}
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-10 max-w-lg"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Enter your practice name"
                className="flex-1 rounded-lg border-0 px-5 py-3.5 text-gray-900 shadow-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                required
              />
              <button
                type="submit"
                disabled={researching}
                className="rounded-lg bg-white px-8 py-3.5 font-semibold text-blue-700 shadow-lg transition hover:bg-blue-50 disabled:opacity-50"
              >
                {researching ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Looking up...
                  </span>
                ) : (
                  "Get Started"
                )}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-200">{error}</p>
            )}
          </form>
        </div>
      </div>

      {/* How it works */}
      <div className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">How It Works</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
              1
            </div>
            <h3 className="mt-4 text-lg font-semibold">Enter Your Practice Name</h3>
            <p className="mt-2 text-gray-500">
              Type your clinic or practice name and we'll do the rest.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
              2
            </div>
            <h3 className="mt-4 text-lg font-semibold">Review Your Details</h3>
            <p className="mt-2 text-gray-500">
              We'll auto-fill your practice info. Just review and correct anything.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
              3
            </div>
            <h3 className="mt-4 text-lg font-semibold">Submit & You're Done</h3>
            <p className="mt-2 text-gray-500">
              Add your contact info, submit, and our team will be in touch.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Orthia. All rights reserved.
      </footer>
    </main>
  );
}
