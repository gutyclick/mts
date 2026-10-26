import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyTripSim",
    short_name: "MyTripSim",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfdfe",
    theme_color: "#1269ed",
    icons: [192, 512].map((size) => ({
      src: `/icons/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
}
