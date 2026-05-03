import axios from 'axios';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const HOME_BASE = {
  label: 'Kentville, Nova Scotia',
  lat: 45.0779,
  lng: -64.496,
};
const SERVICE_DISTANCE_FACTOR = 1.35;
const CORE_RADIUS_KM = 15;
const REGULAR_RADIUS_KM = 35;
const EXTENDED_RADIUS_KM = 55;
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
};
const responseCache = new Map();

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(start, end) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(start, end) {
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);
  const lngDelta = toRadians(end.lng - start.lng);

  const y = Math.sin(lngDelta) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lngDelta);

  return (Math.atan2(y, x) * 180) / Math.PI;
}

function getZone(distanceKm) {
  if (distanceKm <= REGULAR_RADIUS_KM) {
    return 'regular';
  }

  if (distanceKm <= EXTENDED_RADIUS_KM) {
    return 'extended';
  }

  return 'outside';
}

function getVisualZone(distanceKm, zone) {
  if (zone === 'regular' && distanceKm <= CORE_RADIUS_KM) {
    return 'core';
  }

  return zone;
}

function buildPayload(address, geocodeResult) {
  const location = {
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
  };
  const directDistanceKm = haversineDistanceKm(HOME_BASE, location);
  const serviceDistanceKm = directDistanceKm * SERVICE_DISTANCE_FACTOR;
  const zone = getZone(serviceDistanceKm);

  return {
    inputAddress: address,
    formattedAddress: geocodeResult.formattedAddress,
    latitude: geocodeResult.lat,
    longitude: geocodeResult.lng,
    distanceKm: Number(serviceDistanceKm.toFixed(1)),
    directDistanceKm: Number(directDistanceKm.toFixed(1)),
    zone,
    visualZone: getVisualZone(serviceDistanceKm, zone),
    bearing: Math.round(bearingDegrees(HOME_BASE, location)),
    baseLabel: HOME_BASE.label,
    thresholds: {
      coreKm: CORE_RADIUS_KM,
      regularKm: REGULAR_RADIUS_KM,
      extendedKm: EXTENDED_RADIUS_KM,
    },
    source: geocodeResult.source,
  };
}

function looksLikeExplicitRegion(address = '') {
  return /\b(ns|nova scotia|nb|new brunswick|pei|prince edward island|nl|newfoundland|on|ontario|qc|quebec|canada)\b/i.test(
    address
  );
}

async function geocodeWithGoogleParams(params, sourceLabel) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await axios.get(GOOGLE_GEOCODE_URL, {
    timeout: 5000,
    params: {
      ...params,
      key: apiKey,
      region: 'ca',
      ...(params.place_id ? {} : { components: 'country:CA' }),
    },
  });

  if (response.data?.status !== 'OK' || !response.data?.results?.length) {
    return null;
  }

  const bestMatch = response.data.results[0];
  const location = bestMatch.geometry?.location;

  if (!location) {
    return null;
  }

  return {
    formattedAddress: bestMatch.formatted_address,
    lat: location.lat,
    lng: location.lng,
    source: sourceLabel,
  };
}

async function geocodeWithGoogleAddress(address) {
  return geocodeWithGoogleParams(
    {
      address,
    },
    'google'
  );
}

async function geocodeWithGooglePlaceId(placeId) {
  return geocodeWithGoogleParams(
    {
      place_id: placeId,
    },
    'google-place-id'
  );
}

async function geocodeWithNominatim(address) {
  const response = await axios.get(NOMINATIM_SEARCH_URL, {
    timeout: 6000,
    headers: {
      'Accept-Language': 'en-CA,en;q=0.9',
      'User-Agent': 'NovaDetailingServiceAreaChecker/1.0 (thenovadetailing.ca)',
    },
    params: {
      q: address,
      countrycodes: 'ca',
      format: 'jsonv2',
      limit: 1,
    },
  });

  if (!Array.isArray(response.data) || response.data.length === 0) {
    return null;
  }

  const match = response.data[0];

  return {
    formattedAddress: match.display_name,
    lat: Number(match.lat),
    lng: Number(match.lon),
    source: 'nominatim',
  };
}

async function geocodeAddress(address, placeId = '') {
  if (placeId) {
    try {
      const placeResult = await geocodeWithGooglePlaceId(placeId);

      if (placeResult) {
        return placeResult;
      }
    } catch (error) {
      console.error('Google placeId geocode failed:', error.response?.data || error.message);
    }
  }

  const tries = looksLikeExplicitRegion(address)
    ? [address]
    : [`${address}, Nova Scotia, Canada`, address];

  for (const candidate of tries) {
    try {
      const googleResult = await geocodeWithGoogleAddress(candidate);

      if (googleResult) {
        return googleResult;
      }
    } catch (error) {
      console.error('Google geocode failed:', error.response?.data || error.message);
    }
  }

  for (const candidate of tries) {
    try {
      const nominatimResult = await geocodeWithNominatim(candidate);

      if (nominatimResult) {
        return nominatimResult;
      }
    } catch (error) {
      console.error('Nominatim geocode failed:', error.response?.data || error.message);
    }
  }

  return null;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const address = body.address?.trim();
    const placeId = body.placeId?.trim() || '';

    if (!address) {
      return jsonResponse(400, { error: 'Please enter an address to check.' });
    }

    const cacheKey = `${address.toLowerCase()}::${placeId}`;
    const cached = responseCache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt < 30 * 60 * 1000) {
      return jsonResponse(200, cached.payload);
    }

    const geocodeResult = await geocodeAddress(address, placeId);

    if (!geocodeResult) {
      return jsonResponse(404, {
        error:
          'We could not confidently place that address yet. Try a fuller address or pick the closest suggestion from the list.',
      });
    }

    const payload = buildPayload(address, geocodeResult);
    responseCache.set(cacheKey, {
      payload,
      cachedAt: Date.now(),
    });

    return jsonResponse(200, payload);
  } catch (error) {
    console.error('Service area check failed:', error);

    return jsonResponse(500, {
      error:
        'We hit a problem checking that address. Please try again or open chat and send it to us directly.',
    });
  }
}
