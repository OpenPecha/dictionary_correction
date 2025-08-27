/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "s3.amazonaws.com",
      },
    ],
  },
};

module.exports = nextConfig;
