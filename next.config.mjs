/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Audio uploads can be a few MB; allow larger server action / route bodies.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
