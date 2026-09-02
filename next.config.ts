import os from "node:os";
import type { NextConfig } from "next";

/**
 * Next 16 blocks cross-origin requests to dev resources (`/_next/*`) by
 * default, so opening the dev server from a phone on the same WiFi serves the
 * HTML but never boots the client. The page then renders stuck in Framer
 * Motion's initial state — `translateY(108%)`, `opacity: 0` — which looks like
 * a broken layout rather than a blocked request.
 *
 * Enumerating the machine's own LAN addresses rather than hardcoding one keeps
 * this working when DHCP hands out a different IP tomorrow. Development only;
 * `next start` and Vercel are unaffected.
 */
const lanOrigins = Object.values(os.networkInterfaces())
  .flat()
  .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
  .map((iface) => iface!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanOrigins,

  /**
   * The chat route reads src/content/knowledge.md off disk at request time so
   * the studio's facts can be edited without a rebuild. Next's tracer cannot
   * see that read (the path is composed at runtime), so a standalone build
   * would ship without the file and every chat turn would 500.
   */
  outputFileTracingIncludes: {
    "/api/chat": ["./src/content/knowledge.md"],
  },

  images: {
    // Local media only; every asset is served from /public.
    formats: ["image/avif", "image/webp"],
  },

  experimental: {
    // The chat streams token by token; keeping the proxy from buffering is the
    // difference between a live typing effect and one lump arriving at the end.
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
