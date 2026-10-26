import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/es/ayuda",
        destination: "/es/preguntas-frecuentes",
        permanent: true,
      },
      { source: "/en/help", destination: "/en/faq", permanent: true },
    ];
  },
};
export default nextConfig;
