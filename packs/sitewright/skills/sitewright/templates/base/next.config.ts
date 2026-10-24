import type { NextConfig } from 'next';

const config: NextConfig = {
  // Images come from signed, short-lived URLs on a bucket, so Next's optimiser cannot fetch them and would only add a hop that
  // expires. Plain <img> throughout.
  images: { unoptimized: true },
  // A self-contained server (.next/standalone/server.js) with only the node_modules it uses: deploy that folder and start it
  // with `node server.js`.
  // SITEWRIGHT_EXPORT=1 builds plain static files instead (only valid for sites without API routes, e.g. the effects gallery).
  ...(process.env.SITEWRIGHT_EXPORT === '1'
    ? { output: 'export' as const, trailingSlash: true, basePath: process.env.SITEWRIGHT_BASE_PATH ?? '' }
    : { output: 'standalone' as const }),
  // The local storage driver reads paths built at runtime, so the file tracer would copy whatever sits in those folders into
  // the bundle - your uploaded files, on a developer machine. Never ship them.
  outputFileTracingExcludes: {
    '/**': ['./.storage/**/*', './.pgdata/**/*', './.env*'],
  },
  eslint: { ignoreDuringBuilds: true },
  // PGlite ships Postgres as WebAssembly and locates it relative to its own module URL; bundled by Next that resolution fails.
  // `pg` is native and must not be bundled either.
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
};

export default config;
