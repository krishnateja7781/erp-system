/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle (Docker / any Node host).
  output: 'standalone',

  serverExternalPackages: ['@supabase/ssr'],

  experimental: {
    // Bulk attendance / CSV uploads can exceed the 1 MB default.
    serverActions: { bodySizeLimit: '10mb' },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Type errors must fail the build — never ship code that doesn't typecheck.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
