import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Lightweight fast-path gate. This only checks for the presence of the Better
 * Auth session cookie — it does NOT validate it. The real authorization gate
 * is the server component in src/app/(app)/layout.tsx (getCurrentUser), which
 * reads the authoritative user row. This just avoids flashing app chrome to
 * clearly-unauthenticated visitors and bounces signed-in users off /login.
 */
const APP_PREFIXES = [
  "/dashboard",
  "/invoices",
  "/customers",
  "/recurring",
  "/settings",
];
const AUTH_PATHS = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  const isAppRoute = APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthRoute = AUTH_PATHS.includes(pathname);

  if (isAppRoute && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/dashboard" ? `?next=${pathname}` : "";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/customers/:path*",
    "/recurring/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};
