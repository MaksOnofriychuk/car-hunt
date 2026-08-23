import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
