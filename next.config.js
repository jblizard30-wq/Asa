/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    serverComponentsExternalPackages: ['ws', '@neondatabase/serverless'],
  },
};

module.exports = nextConfig;
