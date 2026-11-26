import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone/server.js: a self-contained server that cPanel's
  // "Setup Node.js App" (Phusion Passenger) can run without installing packages.
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // The app doesn't use Next's image optimiser or Prisma's edge/WASM engines,
  // so leave them out of the upload (saves about 100 MB).
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@img/**",
      "node_modules/sharp/**",
      "node_modules/@prisma/client/runtime/query_compiler_bg.*",
      "node_modules/@prisma/client/runtime/edge*",
      "node_modules/@prisma/client/runtime/wasm*",
      "node_modules/@prisma/client/runtime/*.wasm",
      "node_modules/.prisma/client/query_engine_bg.*",
      "node_modules/.prisma/client/wasm*",
      "node_modules/.prisma/client/edge*",
    ],
  },
  agentRules: false,
};

export default nextConfig;
