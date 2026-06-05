/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  swcMinify: true,
  images: {
    domains: ['firebasestorage.googleapis.com'],
     domains: ['https://pub-940e5831b59242bba98068be3602fd69.r2.dev'],
  },
};

export default nextConfig;


