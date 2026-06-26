import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // I loghi dei canali arrivano da URL esterni arbitrari nel feed XMLTV.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
