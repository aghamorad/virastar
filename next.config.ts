import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Static export so the app can live on GitHub Pages (or any static host).
  output: 'export',
  // GitHub Pages serves the site from a path, not the domain root. The deploy
  // workflow passes BASE_PATH=/virastar; local development keeps it empty.
  basePath: process.env.BASE_PATH ?? '',
  // Let client bundles resolve assets under the same base path on GitHub Pages.
  env: { NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH ?? '' },
  images: { unoptimized: true },
  trailingSlash: true,
  // Don't auto-generate AGENTS.md / CLAUDE.md on every dev/build.
  agentRules: false,
}

export default nextConfig
