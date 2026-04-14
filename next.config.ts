import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/design-spec-content': ['./design-spec.html'],
  },
};

export default nextConfig;
