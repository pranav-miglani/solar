/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Turbopack
  experimental: {
    turbo: true,
  },

  // Keep linting & type-checking ON (your choice)
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // Remove old Webpack splitChunks config — Turbopack handles chunking automatically
};

module.exports = nextConfig;
