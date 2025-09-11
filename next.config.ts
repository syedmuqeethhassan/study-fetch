import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Fallback for Node.js modules that don't work in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      encoding: false,
      fs: false,
    };

    // Also set aliases as a backup
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };

    return config;
  },
  // Move serverComponentsExternalPackages to top level
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;