import { createClient } from "@sanity/client";

export const client = createClient({
  projectId: "ht94ubie",   // your real Sanity project ID
  dataset: "production",    // your Sanity dataset
  apiVersion: "2023-10-10", // today's date or recent
  useCdn: false,             // use the CDN for faster reads
});