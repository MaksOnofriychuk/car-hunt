import type { MetadataRoute } from 'next'

/** Приватний трекер для двох людей. У пошуку йому робити нічого. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
