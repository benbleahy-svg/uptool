import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  // bullmq + its ioredis dep are Node-only; keep them out of the webpack bundle
  // so the CAD-thumbnail producer (server actions / RSC) loads them at runtime.
  // imapflow + mailparser are likewise Node-only (used by the IMAP connect action).
  serverExternalPackages: ["bullmq", "imapflow", "mailparser"],
  // react-pdf pulls in the optional native `canvas` package (Node-only); stop
  // webpack from trying to bundle it for the browser.
  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      canvas: false,
    };
    return webpackConfig;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // jsdelivr + blob: required by online-3d-viewer, which loads the
              // occt-import-js (STEP) parser and a blob Worker from the CDN.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' https://cdn.jsdelivr.net",
              // blob: needed for the quote PDF preview/print iframe (object URL of
              // the server-rendered PDF).
              "frame-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
