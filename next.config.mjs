/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
