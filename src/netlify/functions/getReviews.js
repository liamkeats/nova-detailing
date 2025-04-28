const axios = require('axios');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getWriteReviewUrl(placeId) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

//memory cache
let cachedSummary = null;
let lastReviewCount = 0;

exports.handler = async function(event, context) {
  const { GOOGLE_API_KEY, PLACE_ID } = process.env;

  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: PLACE_ID,
        fields: 'name,rating,reviews,user_ratings_total,url',
        key: GOOGLE_API_KEY
      }
    });

    const result = res.data.result;
    const reviews = result.reviews || [];
    const totalReviews = result.user_ratings_total;

    if (cachedSummary && totalReviews == lastReviewCount) {
      console.log("✅ Using cached AI summary");
      return {
        statusCode: 200,
        body: JSON.stringify({
          rating: result.rating,
          totalReviews,
          url: getWriteReviewUrl(PLACE_ID),
          reviews,
          summaryBullets: cachedSummary,
        }),
      };
    }

    const textBlock = reviews
      .map((r, i) => `${i + 1}. ${r.text || ''}`.trim())
      .filter(Boolean)
      .join('\n');
    
    let summaryBullets = [];

    if (textBlock.length > 0) {
      const prompt = `
You're an assistant summarizing Google reviews for a car detailing business.

Here are some actual reviews:
    
${textBlock}

Give 3 short bullet point summaries that capture what customers loved. Be specific. Each bullet should be a single sentence — casual, specific, and clear. Keep them under 12 words. Think like a review highlight or ad caption.

Only return a JSON array of 3 strings.
      `;
      
      try {
        const chat = await openai.chat.completions.create({
          model: "gpt-4.1-mini-2025-04-14",
          messages: [{ role: "user", content: prompt }],
        });

        let raw = chat.choices[0].message.content;
        console.log("🧠 GPT raw output:", raw);

        raw = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();

        summaryBullets = JSON.parse(raw);
      } catch (err) {
        console.error("❌ AI Summary failed:", err);
        summaryBullets = [
          "Friendly and professional staff",
          "Cars look brand new after service",
          "Great value for the price"
        ];
      }
    }

    cachedSummary = summaryBullets;
    lastReviewCount = totalReviews;

    return {
      statusCode: 200,
      body: JSON.stringify({
        rating: result.rating,
        totalReviews,
        url: getWriteReviewUrl(PLACE_ID),
        reviews: result.reviews || [],
        summaryBullets,
      })
    };
  } catch (error) {
    console.error("Google API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch reviews" })
    };
  }
}
