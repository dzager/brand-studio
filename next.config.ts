import type { NextConfig } from "next";
import fs from "fs";

// Use native realpath to get canonical casing on macOS (case-insensitive FS).
// Mismatched path casing causes duplicate React bundles and build failures.
const projectDir = fs.realpathSync.native(process.cwd());

const nextConfig: NextConfig = {
  turbopack: {
    root: projectDir,
  },
};

export default nextConfig;
