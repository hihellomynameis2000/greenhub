"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type SetPasswordResponse = {
  email: string;
  redirectTo: string;
};

export default function SetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const linkState = new URLSearchParams(window.location.search).get("state");
    if (!linkState) {
      setError("This secure link is invalid or has expired. Request a new password link.");
      return;
    }
    setState(linkState);
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
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, state }),
      });
      const body = (await response.json()) as SetPasswordResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Password setup failed.");
      }

      router.replace(body.redirectTo);
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
          <div className="mt-7 text-sm font-semibold text-emerald-800">Partner portal</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Set your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Create secure access to the GreenHub Partner Portal.
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
              disabled={!state || saving || Boolean(error && !state)}
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
              disabled={!state || saving || Boolean(error && !state)}
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
            disabled={!state || saving || Boolean(error && !state)}
            className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving password..." : "Activate portal access"}
          </button>
        </form>
      </div>
    </div>
  );
}
