/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: ['ws', '@neondatabase/serverless'],
  },
};

module.exports = nextConfig;
