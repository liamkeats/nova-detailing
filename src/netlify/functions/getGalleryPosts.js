import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "ht94ubie",
  dataset: "production",
  apiVersion: "2023-10-10",
  useCdn: true,
});

export async function handler(event, context) {
  const query = `*[_type == "galleryPost"] | order(date desc){
    _id,
    title,
    slug,
    detailType,
    "afterPhoto": afterPhotos[0].asset->url,
    date
  }`;

  try {
    const posts = await client.fetch(query);

    return {
      statusCode: 200,
      body: JSON.stringify(posts),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch posts" }),
    };
  }
}
