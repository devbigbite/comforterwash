/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Send full URL as Referer for cross-origin HTTPS requests so Google
          // Maps API key website restrictions (https://www.comforterwash.com/*)
          // can match the actual page path rather than the bare origin only.
          // Without this, strict-origin-when-cross-origin (browser default) strips
          // the path and sends only https://www.comforterwash.com, which does NOT
          // match the /* wildcard restriction, causing RefererNotAllowedMapError.
          { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: "/facility",
        destination: "/admin/facility",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
