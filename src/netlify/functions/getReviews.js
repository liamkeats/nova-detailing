import axios from 'axios';
import OpenAI from 'openai';

const GOOGLE_PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GOOGLE_PLACE_FIELDS = 'name,rating,reviews,user_ratings_total,url';
const RESPONSE_CACHE_TTL_MS = 30 * 60 * 1000;
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
};
const FALLBACK_SUMMARY_BULLETS = [
  'Friendly and professional staff',
  'Cars look brand new after service',
  'Great value for the price',
];
const OPENAI_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

function getWriteReviewUrl(placeId) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

let cachedSummary = null;
let lastReviewCount = 0;
let cachedPayload = null;
let cachedPayloadAt = 0;
let openAICooldownUntil = 0;

async function buildSummaryBullets(reviews) {
  if (Date.now() < openAICooldownUntil) {
    return FALLBACK_SUMMARY_BULLETS;
  }

  const textBlock = reviews
    .map((review, index) => `${index + 1}. ${review.text || ''}`.trim())
    .filter(Boolean)
    .join('\n');

  if (!textBlock) {
    return FALLBACK_SUMMARY_BULLETS;
  }

  const prompt = `
You're an assistant summarizing Google reviews for a car detailing business.

Here are some actual reviews:

${textBlock}

Give 3 short bullet point summaries that capture what customers loved. Be specific. Each bullet should be a single sentence, casual, specific, and clear. Keep them under 12 words.

Only return a JSON array of 3 strings.
  `;

  try {
    const openai = getOpenAIClient();

    if (!openai) {
      throw new Error('Missing OPENAI_API_KEY');
    }

    const chat = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = chat.choices[0].message.content ?? '[]';

    raw = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, '$1').trim();

    return JSON.parse(raw);
  } catch (error) {
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      openAICooldownUntil = Date.now() + OPENAI_RETRY_COOLDOWN_MS;
      console.warn('AI review summary quota unavailable. Using fallback bullets for now.');
    } else {
      console.error('AI review summary failed:', error);
    }

    return FALLBACK_SUMMARY_BULLETS;
  }
}

export async function handler(event, context) {
  const { GOOGLE_API_KEY, PLACE_ID } = process.env;

  if (cachedPayload && Date.now() - cachedPayloadAt < RESPONSE_CACHE_TTL_MS) {
    return jsonResponse(200, cachedPayload);
  }

  try {
    const res = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
      timeout: 5000,
      params: {
        place_id: PLACE_ID,
        fields: GOOGLE_PLACE_FIELDS,
        key: GOOGLE_API_KEY,
      },
    });

    const result = res.data?.result ?? {};
    const reviews = Array.isArray(result.reviews) ? result.reviews : [];
    const totalReviews = result.user_ratings_total ?? reviews.length;

    let summaryBullets = cachedSummary;

    if (!summaryBullets || totalReviews !== lastReviewCount) {
      summaryBullets = await buildSummaryBullets(reviews);
    }

    const payload = {
      rating: result.rating,
      totalReviews,
      url: getWriteReviewUrl(PLACE_ID),
      reviews,
      summaryBullets,
    };

    cachedSummary = summaryBullets;
    lastReviewCount = totalReviews;
    cachedPayload = payload;
    cachedPayloadAt = Date.now();

    return jsonResponse(200, payload);
  } catch (error) {
    console.error('Google API Error:', error);
    return jsonResponse(500, {
      error: 'Failed to fetch reviews',
      summaryBullets: FALLBACK_SUMMARY_BULLETS,
    });
  }
}
