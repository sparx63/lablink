/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is for Docker/Cloud Run only. Vercel uses default Next output
  // (standalone hurts Vercel tracing / serverless packaging).
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
