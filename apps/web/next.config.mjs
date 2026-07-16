/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker
  output: "standalone",

  // Strict mode for catching React bugs early
  reactStrictMode: true,

  // Trust internal package TypeScript
  transpilePackages: ["@schoolmitra/dpdp", "@schoolmitra/validators", "@schoolmitra/ui"],

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.razorpay.com",
              "frame-src https://api.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Image optimization — student photos served via signed S3 URLs
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000", // MinIO dev
      },
    ],
  },

  // Experimental features
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ["pg", "ioredis", "bcryptjs", "bullmq"],
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
