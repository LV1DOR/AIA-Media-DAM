export default {
  output: "standalone",
  distDir: process.env.AIA_REVIEW_PREVIEW === "1" ? ".next-review" : ".next",
  experimental: { cpus: 2 },
  transpilePackages: ["@aia/ui", "@aia/contracts"],
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          (process.env.AIA_API_INTERNAL_URL || "http://127.0.0.1:4100") +
          "/api/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
