/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack — Webpack is more stable and uses far less disk
  experimental: {},

  // Enable standalone output for Docker deployment
  output: 'standalone',

  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
