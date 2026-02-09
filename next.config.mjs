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

  serverExternalPackages: ['jsdom', 'parse5'],

  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.svg$/i,
      use: [
        {
          loader: "@svgr/webpack",
          options: { svgo: false },
        },
      ],
    });

    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('parse5');
      } else if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = (context, request, callback) => {
          if (request === 'parse5') {
            return callback(null, 'commonjs parse5');
          }
          return originalExternals(context, request, callback);
        };
      }
    }

    return config;
  },
};

export default nextConfig;
