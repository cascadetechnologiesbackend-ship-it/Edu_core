let withAnalyzer = (config) => config;

if (process.env.ANALYZE === "true") {
  try {
    const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
    withAnalyzer = bundleAnalyzer({
      enabled: true,
    });
  } catch {
    console.warn("@next/bundle-analyzer not installed, continuing build without analyzer.");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker
  ...(process.env.NEXT_OUTPUT_STANDALONE ? { output: "standalone" } : {}),

  // Enabled per Requirement 17.6 for production readiness
  reactStrictMode: true,

  // Trust internal package TypeScript
  transpilePackages: [
    "@schoolmitra/dpdp",
    "@schoolmitra/validators",
    "@schoolmitra/ui",
    "@schoolmitra/database",
    "@schoolmitra/backend",
  ],

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
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === "production"
                ? "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com"
                : "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.razorpay.com",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Canonical redirects from legacy fees routes to unified finance suite
  async redirects() {
    return [
      {
        source: "/fees/collect",
        destination: "/school/collect-fees",
        permanent: true,
      },
      {
        source: "/fees/structures",
        destination: "/school/fee-structures",
        permanent: true,
      },
      {
        source: "/school/fees/structures",
        destination: "/school/fee-structures",
        permanent: true,
      },
      {
        source: "/fees/concessions",
        destination: "/school/fees-discount",
        permanent: true,
      },
      {
        source: "/fees",
        destination: "/school/fees-dashboard",
        permanent: true,
      },
      {
        source: "/accountant/dashboard",
        destination: "/school/fees-dashboard",
        permanent: true,
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

  // Keep compiled pages in memory during dev (default is only 15s before purging!)
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000, // 1 hour
    pagesBufferLength: 50,
  },

  // Fast SWC direct icon imports — prevents scanning all 1400+ Lucide icons
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{kebabCase member}}",
    },
  },

  // Experimental features
  experimental: {
    externalDir: true,
    typedRoutes: true,
    serverComponentsExternalPackages: [
      "pg",
      "ioredis",
      "bcryptjs",
      "bullmq",
      "@react-pdf/renderer",
      "exceljs",
      "aws-sdk",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
      "pino",
      "pino-pretty",
      "nodemailer",
      "razorpay",
      "qrcode",
      "otplib",
    ],
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "cmdk",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
    ],
    // Router cache: keep RSC payloads for 30s on dynamic pages, 180s on static
    // This makes Back/Forward navigation instant and repeated module clicks instant
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // Logging — disable in dev for speed
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default withAnalyzer(nextConfig);
