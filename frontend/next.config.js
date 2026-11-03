// STATIC_EXPORT=true builds plain HTML/JS files into out/ for a static host (the
// Render demo uses this). Otherwise `next build` emits a self-contained server in
// .next/standalone for the Docker image.
const staticExport = process.env.STATIC_EXPORT === "true";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: staticExport ? "export" : "standalone",
  // Writes players/index.html rather than players.html, which any static host serves at /players/
  trailingSlash: staticExport,
  poweredByHeader: false,
  // A static host sets its own headers (see render.yaml), so only the Node server needs these.
  ...(staticExport ? {} : { headers: async () => [{ source: "/:path*", headers: securityHeaders }] }),
};

module.exports = nextConfig;
