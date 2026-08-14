import type { MetadataRoute } from "next";

/**
 * The app is one public page and wants to be found — nothing here is worth
 * hiding from a crawler except the API, which serves the same data the page
 * already shows and only costs a database round trip to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    host: "https://www.sourcesduvercors.fr",
  };
}
