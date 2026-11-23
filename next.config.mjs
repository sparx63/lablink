/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is for Docker/Cloud Run. Vercel uses the default Next.js output.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" } : {}),
  poweredByHeader: false,
};

export default nextConfig;
