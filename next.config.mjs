/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  experimental: {
    // Report generators run in Node route handlers; bundling them breaks
    // @react-pdf's wasm layout engine, so they load from node_modules directly.
    serverComponentsExternalPackages: ["@react-pdf/renderer", "exceljs"],
  },
};

export default nextConfig;
