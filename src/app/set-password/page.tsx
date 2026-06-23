"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getPortalSupabase, portalRequest } from "@/lib/portal/client";
import type { PortalBootstrap } from "@/lib/portal/types";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function checkInviteSession() {
      try {
        const {
          data: { session },
        } = await getPortalSupabase().auth.getSession();

        if (!session?.user.email) {
          if (isCurrent) {
            setError("This invitation link is invalid or has expired. Ask your administrator for a new invitation.");
          }
          return;
        }

        if (isCurrent) setEmail(session.user.email);
      } catch (sessionError) {
        if (isCurrent) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : "We could not verify this invitation link."
          );
        }
      } finally {
        if (isCurrent) setCheckingSession(false);
      }
    }

    checkInviteSession();
    return () => {
      isCurrent = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await getPortalSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;

      const bootstrap = await portalRequest<PortalBootstrap>("/api/portal/bootstrap");
      router.replace(bootstrap.profile.role === "admin" ? "/portal/admin" : "/portal/agent");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Password setup failed.");
      setSaving(false);
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
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Set your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {email ? `Create secure access for ${email}.` : "Create secure access to the portal."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-7 py-7 sm:px-8">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            New password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              type="password"
              required
              disabled={checkingSession || Boolean(error && !email)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Confirm password
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Re-enter your password"
              type="password"
              required
              disabled={checkingSession || Boolean(error && !email)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 placeholder:text-slate-500 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={checkingSession || saving || Boolean(error && !email)}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingSession ? "Verifying invitation..." : saving ? "Saving password..." : "Activate portal access"}
          </button>
        </form>
      </div>
    </div>
  );
}
