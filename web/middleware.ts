import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const isProd = process.env.NODE_ENV === "production";

  // Security headers for all routes
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // wasm-unsafe-eval: required by Three.js Draco decoder for WASM-based mesh decompression
      // ajax.googleapis.com: @google/model-viewer web component (iOS AR Quick Look, Android Scene Viewer)
      isProd
        ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://ajax.googleapis.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://ajax.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      // raw.githubusercontent.com: @react-three/drei HDR environment maps (raw.githack.com redirects here)
      // rawcdn.githack.com: drei cloud/normal textures
      // cdn.jsdelivr.net: drei KTX2 decoder and matcap assets
      "connect-src 'self' blob: https://raw.githubusercontent.com https://raw.githack.com https://rawcdn.githack.com https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Permissions-Policy: camera only on AR routes
  const isARRoute =
    request.nextUrl.pathname.includes("/ar") ||
    request.nextUrl.pathname.includes("/try-on");

  if (isARRoute) {
    response.headers.set("Permissions-Policy", "camera=(self), microphone=()");
  } else {
    response.headers.set("Permissions-Policy", "camera=(), microphone=()");
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and api
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
