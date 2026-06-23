import { NextRequest, NextResponse } from "next/server";

const canonicalPortalHost = process.env.NEXT_PUBLIC_PORTAL_HOST ?? "console.greenhub.io";

function hostname(request: NextRequest) {
  return (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
}

function redirectToPortal(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = canonicalPortalHost;
  url.port = "";
  url.pathname = pathname;
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const host = hostname(request);
  const { pathname } = request.nextUrl;

  if (host === "agents.greenhub.io") {
    if (pathname === "/") return redirectToPortal(request, "/portal/agent");
    if (pathname === "/accounts") return redirectToPortal(request, "/portal/agent/accounts");
    if (pathname === "/residuals") return redirectToPortal(request, "/portal/agent/residuals");
    return redirectToPortal(request, pathname);
  }

  if (host === "admin.greenhub.io") {
    if (pathname === "/") return redirectToPortal(request, "/portal/admin");
    if (pathname === "/agents") return redirectToPortal(request, "/portal/admin/agents");
    if (pathname === "/accounts") return redirectToPortal(request, "/portal/admin/accounts");
    if (pathname === "/residuals") return redirectToPortal(request, "/portal/admin/residuals");
    return redirectToPortal(request, pathname);
  }

  if (host === canonicalPortalHost && pathname === "/") {
    return redirectToPortal(request, "/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
