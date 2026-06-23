"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getPortalSupabase, portalRequest } from "@/lib/portal/client";
import type { PortalBootstrap } from "@/lib/portal/types";

export default function PortalRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      let data;

      try {
        data = await getPortalSupabase().auth.getSession();
      } catch {
        router.replace("/login");
        return;
      }

      const userEmail = data.data.session?.user?.email;

      if (!userEmail) {
        router.replace("/login");
        return;
      }

      try {
        const bootstrap = await portalRequest<PortalBootstrap>("/api/portal/bootstrap");
        router.replace(bootstrap.profile.role === "admin" ? "/portal/admin" : "/portal/agent");
      } catch {
        router.replace("/login");
      }
    }

    run();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-700 shadow-sm">
        Checking portal access...
      </div>
    </div>
  );
}
