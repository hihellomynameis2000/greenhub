"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSending(true);

    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Password recovery could not be started.");
      }

      setMessage("If this email has portal access, a secure password link is on its way.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Password recovery could not be started."
      );
    } finally {
      setSending(false);
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
          <div className="mt-7 text-sm font-semibold text-emerald-800">Residual portal</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Reset your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Enter your portal email and we will send a secure password link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-7 py-7 sm:px-8">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Email address
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@greenhubinc.com"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending password link..." : "Send password link"}
          </button>
        </form>

        <div className="border-t border-slate-200 bg-slate-50 px-7 py-5 sm:px-8">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 transition-colors hover:text-slate-950"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
