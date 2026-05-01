import { createClient } from "@sanity/client";
import { createImageUrlBuilder } from "@sanity/image-url";

const client = createClient({
  projectId: "ht94ubie",
  dataset: "production",
  apiVersion: "2023-10-10",
  useCdn: true,
});

const builder = createImageUrlBuilder(client);

export async function handler(event, context) {
  const query = `*[_type == "galleryPost"] | order(date desc){
    _id,
    title,
    slug,
    detailType,
    "afterPhoto": afterPhotos[0],
    "afterPhotoDimensions": afterPhotos[0].asset->metadata.dimensions,
    date
  }`;

  try {
    const posts = await client.fetch(query);
    const optimizedPosts = posts.map((post) => ({
      _id: post._id,
      title: post.title,
      slug: post.slug,
      detailType: post.detailType,
      date: post.date,
      afterPhoto: post.afterPhoto
        ? builder.image(post.afterPhoto).width(900).fit("max").auto("format").quality(75).url()
        : null,
      afterPhotoWidth: post.afterPhotoDimensions?.width ?? null,
      afterPhotoHeight: post.afterPhotoDimensions?.height ?? null,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(optimizedPosts),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch posts" }),
    };
  }
}
