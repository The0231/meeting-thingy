/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off so the in-app audio recorder isn't double-mounted in dev.
  reactStrictMode: false,
  // Audio uploads can be a few MB; allow larger server action / route bodies.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
