/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel gère lui-même le runtime Next.js. `standalone` est réservé au VPS/Docker.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  poweredByHeader: false,
};

export default nextConfig;
