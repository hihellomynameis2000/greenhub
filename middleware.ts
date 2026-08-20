import { NextRequest, NextResponse } from "next/server";
import {
  adminPortalHost,
  partnerPortalHost,
  requestHost,
} from "./src/lib/portal/hosts";

const authPaths = new Set(["/login", "/forgot-password", "/set-password"]);

function redirectToHost(request: NextRequest, host: string, pathname: string) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = host;
  url.port = "";
  url.pathname = pathname;
  return NextResponse.redirect(url, 308);
}

function redirectToPath(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const host = requestHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;
  const adminHost = adminPortalHost();
  const partnerHost = partnerPortalHost();

  if (host === "agents.greenhub.io") {
    if (pathname === "/") return redirectToHost(request, partnerHost, "/login");
    if (authPaths.has(pathname)) return redirectToHost(request, partnerHost, pathname);
    if (pathname === "/portal" || pathname === "/portal/agent") {
      return redirectToHost(request, partnerHost, "/portal/agent");
    }
    if (pathname === "/crm") return redirectToHost(request, partnerHost, "/portal/agent/crm");
    if (pathname === "/platforms") return redirectToHost(request, partnerHost, "/portal/agent/platforms");
    if (pathname.startsWith("/platforms/")) {
      return redirectToHost(request, partnerHost, `/portal/agent${pathname}`);
    }
    if (pathname === "/submit-deal") return redirectToHost(request, partnerHost, "/portal/agent/submit-deal");
    if (pathname === "/accounts") return redirectToHost(request, partnerHost, "/portal/agent/accounts");
    if (pathname === "/residuals") return redirectToHost(request, partnerHost, "/portal/agent/residuals");
    if (pathname === "/support") return redirectToHost(request, partnerHost, "/portal/agent/support");
    return redirectToHost(request, partnerHost, pathname);
  }

  if (host === adminHost) {
    if (pathname === "/") return redirectToPath(request, "/login");
    if (pathname === "/portal") return redirectToPath(request, "/portal/admin");
    if (pathname.startsWith("/portal/agent")) return redirectToPath(request, "/portal/admin");
    if (pathname === "/crm") return redirectToPath(request, "/portal/admin/crm");
    if (pathname === "/platform-library") return redirectToPath(request, "/portal/admin/platform-library");
    if (pathname === "/folder-access") return redirectToPath(request, "/portal/admin/folder-access");
    if (pathname === "/agents") return redirectToPath(request, "/portal/admin/agents");
    if (pathname === "/accounts") return redirectToPath(request, "/portal/admin/accounts");
    if (pathname === "/residuals") return redirectToPath(request, "/portal/admin/residuals");
    return NextResponse.next();
  }

  if (host === partnerHost) {
    if (pathname === "/") return redirectToPath(request, "/login");
    if (pathname === "/portal") return redirectToPath(request, "/portal/agent");
    if (pathname.startsWith("/portal/admin")) {
      return redirectToHost(request, adminHost, pathname);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
