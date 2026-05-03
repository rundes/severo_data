// @ts-check

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/severo_data"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
