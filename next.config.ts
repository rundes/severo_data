import type { NextConfig } from "next"

// In GitHub Pages the app lives at /<repo-name>/.
// Set NEXT_PUBLIC_BASE_PATH="" in .env.local for local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/severo_data"

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
