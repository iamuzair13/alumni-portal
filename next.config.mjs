/** @type {import('next').NextConfig} */
import dotenv from 'dotenv';
dotenv.config();

const extraDomains = (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com", "readymadeui.com", ...extraDomains],
    remotePatterns: extraDomains.map((d) => ({ protocol: "https", hostname: d, port: "", pathname: "**" })),
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      use: [
        {
          loader: "@svgr/webpack",
          options: { svgo: false },
        },
      ],
    });
    return config;
  },
};

export default nextConfig;
