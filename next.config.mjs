/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn11.bigcommerce.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
