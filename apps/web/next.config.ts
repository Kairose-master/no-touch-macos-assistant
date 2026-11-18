import type { NextConfig } from 'next';
// The agent is a separate loopback process, started with --no-default-extensions.
const config: NextConfig = {
  async rewrites() { return [{ source: '/eve/:path*', destination: 'http://127.0.0.1:2000/eve/:path*' }]; },
};
export default config;
