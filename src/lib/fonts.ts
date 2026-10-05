import localFont from "next/font/local";

// Self-hosted fonts — avoids the build-time Google Fonts download that
// next/font/google requires, so builds work on servers without egress.
export const roboto = localFont({
  src: [
    { path: "./fonts/roboto-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/roboto-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const outfit = localFont({
  src: "./fonts/outfit-variable.woff2",
  display: "swap",
});
