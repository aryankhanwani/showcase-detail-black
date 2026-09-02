import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
