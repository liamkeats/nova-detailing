import axios from 'axios';

const GOOGLE_PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const SEARCH_AREA = {
  low: {
    latitude: 44.1,
    longitude: -65.95,
  },
  high: {
    latitude: 45.75,
    longitude: -63.25,
  },
};
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};
const responseCache = new Map();

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

function getProvinceWeight(secondaryText = '') {
  if (/\b(NS|Nova Scotia)\b/i.test(secondaryText)) {
    return 0;
  }

  if (/\b(NB|New Brunswick|PE|Prince Edward Island)\b/i.test(secondaryText)) {
    return 1;
  }

  return 2;
}

function getLocalityBonus(text = '') {
  return /(kentville|new minas|wolfville|coldbrook|centreville|port williams|canning|grafton|berwick|greenwood|windsor|new ross)/i.test(
    text
  )
    ? -0.25
    : 0;
}

function normalizeSuggestions(items = []) {
  const mapped = items
    .map((item) => {
      const prediction = item.placePrediction;
      const description = prediction?.text?.text?.trim();
      const placeId = prediction?.placeId?.trim();
      const mainText = prediction?.structuredFormat?.mainText?.text?.trim() || description;
      const secondaryText = prediction?.structuredFormat?.secondaryText?.text?.trim() || '';

      if (!description || !placeId) {
        return null;
      }

      return {
        description,
        placeId,
        mainText,
        secondaryText,
        provinceWeight: getProvinceWeight(secondaryText),
        localBonus: getLocalityBonus(`${description} ${secondaryText}`),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftScore = left.provinceWeight + left.localBonus;
      const rightScore = right.provinceWeight + right.localBonus;

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.description.localeCompare(right.description);
    });

  const hasNovaScotiaResult = mapped.some((item) => item.provinceWeight === 0);
  const filtered = hasNovaScotiaResult
    ? mapped.filter((item) => item.provinceWeight === 0)
    : mapped;

  return filtered.slice(0, 5).map(
    ({ description, placeId, mainText, secondaryText }) => ({
      description,
      placeId,
      mainText,
      secondaryText,
    })
  );
}

async function getSuggestionsFromGoogle(input, sessionToken) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return [];
  }

  const response = await axios.post(
    GOOGLE_PLACES_AUTOCOMPLETE_URL,
    {
      input,
      includedRegionCodes: ['ca'],
      locationRestriction: {
        rectangle: {
          low: SEARCH_AREA.low,
          high: SEARCH_AREA.high,
        },
      },
      ...(sessionToken ? { sessionToken } : {}),
    },
    {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
      },
    }
  );

  return normalizeSuggestions(response.data?.suggestions || []);
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const input = event.queryStringParameters?.input?.trim() || '';
    const sessionToken = event.queryStringParameters?.sessionToken?.trim() || '';

    if (input.length < 4) {
      return jsonResponse(200, { suggestions: [], source: 'google' });
    }

    const cacheKey = `${input.toLowerCase()}::${sessionToken}`;
    const cached = responseCache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
      return jsonResponse(200, cached.payload);
    }

    const suggestions = await getSuggestionsFromGoogle(input, sessionToken);
    const payload = {
      suggestions,
      source: 'google',
    };

    responseCache.set(cacheKey, {
      payload,
      cachedAt: Date.now(),
    });

    return jsonResponse(200, payload);
  } catch (error) {
    console.error('Address suggestion lookup failed:', error.response?.data || error.message);

    return jsonResponse(200, {
      suggestions: [],
      source: 'google',
    });
  }
}
