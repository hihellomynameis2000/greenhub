"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getPortalSupabase, portalRequest } from "@/lib/portal/client";

type AuthStep = "credentials" | "code";

type TwoFactorSendResponse = {
  email: string;
  expiresInSeconds: number;
  role: "admin" | "agent";
};

type TwoFactorVerifyResponse = {
  redirectTo: string;
  role: "admin" | "agent";
};

export default function LoginPage() {
  const router = useRouter();
  const [accessCopy, setAccessCopy] = useState({
    eyebrow: "Partner portal",
    help: "Secure access for GreenHub administrators, agents, and partners.",
    title: "Sign in to GreenHub",
  });
  const [step, setStep] = useState<AuthStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function restoreCodeStep() {
      if (window.location.hostname === "admin.greenhub.io") {
        setAccessCopy({
          eyebrow: "Admin portal",
          help: "Secure administrator access for GreenHub operations.",
          title: "Admin sign in",
        });
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("password") === "updated") {
        setNotice("Password updated. Sign in to continue.");
        window.history.replaceState(null, "", "/login");
      }

      if (params.get("verify") !== "sent") return;

      try {
        const {
          data: { session },
        } = await getPortalSupabase().auth.getSession();
        if (!session?.user.email) return;

        setEmail(session.user.email);
        setStep("code");
        setNotice("We sent a verification code to your portal email.");
        window.history.replaceState(null, "", "/login");
      } catch {
        setStep("credentials");
      }
    }

    void restoreCodeStep();
  }, []);

  async function sendVerificationCode() {
    const result = await portalRequest<TwoFactorSendResponse>("/api/auth/two-factor/send", {
      method: "POST",
    });
    setStep("code");
    setNotice(`We sent a verification code to ${result.email}.`);
    return result;
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const { error: authError } = await getPortalSupabase().auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      await sendVerificationCode();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Use the ")) {
        await getPortalSupabase().auth.signOut();
      }
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const result = await portalRequest<TwoFactorVerifyResponse>("/api/auth/two-factor/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      router.push(result.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      await sendVerificationCode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send another code.");
    } finally {
      setLoading(false);
    }
  }

  async function restartLogin() {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      await fetch("/api/auth/two-factor/session", { method: "DELETE" });
      await getPortalSupabase().auth.signOut();
    } finally {
      setPassword("");
      setCode("");
      setStep("credentials");
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
            {accessCopy.eyebrow}
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            {accessCopy.title}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-700">
            {accessCopy.help}
          </p>
        </div>

        {step === "credentials" ? (
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

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-emerald-800 transition-colors hover:text-emerald-950"
              >
                Forgot password?
              </Link>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                {notice}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Checking credentials..." : "Continue securely"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-5 px-7 py-7 sm:px-8">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-900">
              {notice || `Enter the code sent to ${email}.`}
            </div>

            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Verification code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-center text-xl font-semibold tracking-[0.35em] text-slate-950 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify and enter portal"}
            </button>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => void resendCode()}
                className="text-sm font-semibold text-emerald-800 transition-colors hover:text-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resend code
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void restartLogin()}
                className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use another account
              </button>
            </div>
          </form>
        )}

        <div className="border-t border-slate-200 bg-slate-50 px-7 py-5 sm:px-8">
          <p className="text-sm font-semibold text-slate-900">Production access only</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Password and email-code verification are required for every admin and agent sign-in.
          </p>
        </div>
      </div>
    </div>
  );
}
