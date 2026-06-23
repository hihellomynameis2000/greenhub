"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getPortalSupabase, portalRequest } from "@/lib/portal/client";
import type { PortalBootstrap } from "@/lib/portal/types";
import { agents } from "./mockData";
import { PortalDataProvider } from "./PortalDataProvider";
import { PortalNotificationMenu } from "./PortalNotificationMenu";
import { PortalToastViewport } from "./PortalToast";
export { portalInputClass } from "./portalFieldStyles";

type PortalLink = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const adminLinks: PortalLink[] = [
  { href: "/portal/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/portal/admin/agents", icon: Users, label: "Agents" },
  { href: "/portal/admin/accounts", icon: Building2, label: "Accounts" },
  { href: "/portal/admin/residuals", icon: ReceiptText, label: "Residuals" },
];

const agentLinks: PortalLink[] = [
  { href: "/portal/agent", icon: LayoutDashboard, label: "Overview" },
  { href: "/portal/agent/accounts", icon: Building2, label: "Accounts" },
  { href: "/portal/agent/residuals", icon: ReceiptText, label: "Residuals" },
];

function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function PortalShell({
  role,
  children,
}: {
  role: "admin" | "agent";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = role === "admin" ? adminLinks : agentLinks;
  const demoUser = role === "admin" ? agents[0] : agents[1];
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState({
    name: demoUser.name,
    email: demoUser.email,
  });

  useEffect(() => {
    async function loadViewer() {
      let supabase;

      try {
        supabase = getPortalSupabase();
      } catch {
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) return;

      try {
        const bootstrap = await portalRequest<PortalBootstrap>("/api/portal/bootstrap");
        const profile = bootstrap.profile;

        if (profile.role !== role) {
          router.replace(profile.role === "admin" ? "/portal/admin" : "/portal/agent");
          return;
        }

        setViewer({ name: profile.name || nameFromEmail(user.email), email: user.email });
      } catch {
        await supabase.auth.signOut();
        router.replace("/login");
      }
    }

    loadViewer();
  }, [role, router]);

  useEffect(() => {
    if (!menuOpen) return;

    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    setMenuOpen(false);

    try {
      await getPortalSupabase().auth.signOut();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <Image
            src="/images/logo.png"
            alt="GreenHub"
            width={180}
            height={50}
            className="h-9 w-auto"
            priority
          />
        </div>

        <nav className="flex-1 space-y-1 px-4 py-5">
          <div className="mb-2 px-3 text-xs font-medium text-slate-500">
            {role === "admin" ? "Administration" : "Agent reporting"}
          </div>
          {links.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-slate-200 text-slate-950"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-xs leading-5 text-slate-600">
            {role === "admin"
              ? "Portfolio reporting and management"
              : "Finalized portfolio reporting"}
          </p>
        </div>
      </aside>

      <PortalDataProvider>
        <main className="min-h-screen md:pl-64">
        <div className="fixed left-0 right-0 top-0 z-20 bg-white md:left-64">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/images/logo.png"
                  alt="GreenHub"
                  width={120}
                  height={34}
                  className="h-7 w-auto md:hidden"
                  priority
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    GreenHub Residual Portal
                  </p>
                  <p className="hidden text-xs text-slate-600 sm:block">
                    {role === "admin" ? "Administration" : "Agent reporting"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <PortalNotificationMenu role={role} />
                <div ref={menuRef} className="relative">
                <button
                  type="button"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Open account menu"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex h-9 items-center gap-1.5 rounded-full p-0.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold text-white">
                    {initialsFromName(viewer.name)}
                  </span>
                  <ChevronDown aria-hidden="true" className="mr-0.5 h-4 w-4" strokeWidth={2} />
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-300/50"
                  >
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {viewer.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        {viewer.email}
                      </p>
                    </div>
                    {role === "agent" ? (
                      <Link
                        href="/portal/agent/settings"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100"
                      >
                        <Settings aria-hidden="true" className="h-4 w-4 text-slate-500" strokeWidth={1.8} />
                        Account settings
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4 text-slate-500" strokeWidth={1.8} />
                      {signingOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                ) : null}
                </div>
              </div>
            </div>
          </header>

          <nav className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
            <div className="flex gap-1 overflow-x-auto">
              {links.map(({ href, icon: Icon, label }) => {
                const active = pathname === href;

                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                      active
                        ? "bg-slate-200 text-slate-950"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

          <div className="mx-auto max-w-[1600px] px-4 pb-6 pt-[140px] sm:px-6 md:pt-[88px] lg:px-8">
            {children}
          </div>
        </main>
      </PortalDataProvider>
      <PortalToastViewport />
    </div>
  );
}

export function Card({
  title,
  value,
  sub,
  tone = "default",
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: "default" | "accent";
}) {
  const accent = tone === "accent";

  return (
    <div
      className={`rounded-lg border p-5 shadow-sm ${
        accent
          ? "border-emerald-900 bg-emerald-900"
          : "border-slate-200 bg-white"
      }`}
    >
      <div
        className={`text-sm font-semibold ${
          accent ? "text-emerald-100" : "text-slate-700"
        }`}
      >
        {title}
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${
          accent ? "text-white" : "text-slate-950"
        }`}
      >
        {value}
      </div>

      {sub ? (
        <div
          className={`mt-1 text-xs ${
            accent ? "text-emerald-100" : "text-slate-600"
          }`}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
        {title}
      </h1>

      <p className="mt-2 text-sm text-slate-700">{subtitle}</p>
    </div>
  );
}
