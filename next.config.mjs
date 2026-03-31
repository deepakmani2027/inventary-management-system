/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // Fallback top-level image requests to placeholder when missing in `public/`.
      // This prevents 404s for theme/sample images that aren't committed to the repo.
      { source: '/:image+.jpg', destination: '/placeholder.jpg' },
      { source: '/:image+.jpeg', destination: '/placeholder.jpg' },
      { source: '/:image+.webp', destination: '/placeholder.jpg' },
      { source: '/:image+.png', destination: '/placeholder.jpg' },
    ]
  },
}

export default nextConfig
