/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },
}

module.exports = nextConfig
