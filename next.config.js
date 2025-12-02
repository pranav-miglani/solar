/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {},         // <-- FIX: must be {}
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
