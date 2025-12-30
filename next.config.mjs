/** @type {import('next').NextConfig} */
import dotenv from 'dotenv';
dotenv.config();

const extraDomains = (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig = {
  // Remove output: 'standalone' - we're using custom server
  images: {
    domains: ["lh3.googleusercontent.com", "readymadeui.com", ...extraDomains],
    remotePatterns: extraDomains.map((d) => ({ protocol: "https", hostname: d, port: "", pathname: "**" })),
  },
  // Handle ES module compatibility issues with jsdom/parse5
  // Mark these packages as external to avoid bundling issues
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
    
    // Handle parse5 ES module issue by making it external
    if (isServer) {
      config.externals = config.externals || [];
      // Ensure parse5 is treated as external to avoid require() issues
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
