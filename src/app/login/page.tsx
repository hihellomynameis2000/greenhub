"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getPortalSupabase, portalRequest } from "@/lib/portal/client";
import type { PortalBootstrap } from "@/lib/portal/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await getPortalSupabase().auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const bootstrap = await portalRequest<PortalBootstrap>("/api/portal/bootstrap");
      router.push(bootstrap.profile.role === "admin" ? "/portal/admin" : "/portal/agent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl shadow-slate-300/40">
        <div className="border-b border-slate-200 px-7 py-7 sm:px-8">
          <Image
            src="/images/logo.png"
            alt="GreenHub"
            width={190}
            height={60}
            className="h-10 w-auto"
            priority
          />

          <div className="mt-7 text-sm font-semibold text-emerald-800">
            Residual portal
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Sign in to GreenHub
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-700">
            Secure access for administrators and agents.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 px-7 py-7 sm:px-8">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Email address
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@greenhubinc.com"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in securely"}
          </button>
        </form>

        <div className="border-t border-slate-200 bg-slate-50 px-7 py-5 sm:px-8">
          <div className="mb-3 text-sm font-semibold text-slate-700">
            Preview mode
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/portal/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              Admin Preview
            </Link>
            <Link
              href="/portal/agent"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              Agent Preview
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
