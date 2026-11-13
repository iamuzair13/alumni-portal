/** @type {import('next').NextConfig} */
import dotenv from 'dotenv';
dotenv.config();

const extraDomains = (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig = {

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    domains: ["lh3.googleusercontent.com", "readymadeui.com", ...extraDomains],
    remotePatterns: extraDomains.map((d) => ({
      protocol: "https",
      hostname: d,
      port: "",
      pathname: "**"
    })),
  },

  webpack(config) {
    // Keep dev-server artifacts out of the webpack watcher — Playwright MCP
    // appends session logs under .playwright-mcp/ inside the project root,
    // which otherwise re-triggers compilation in a loop.
    config.watchOptions = {
      ...(config.watchOptions || {}),
      ignored: [...(config.watchOptions?.ignored || []), "**/.playwright-mcp/**"],
    };

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
