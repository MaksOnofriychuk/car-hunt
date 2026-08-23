import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Дублює заголовок з middleware і накриває те, до чого middleware не доходить:
        // /_next/static та інші складені ассети.
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      // фото оголошень з AUTO.RIA
      { protocol: 'https', hostname: 'cdn.riastatic.com' },
      { protocol: 'https', hostname: '*.riastatic.com' },
      // заглушки для сідерських даних
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
}

export default nextConfig
