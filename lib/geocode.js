const USER_AGENT = 'running-buddy/1.0 (https://www.annacachadina.me)';

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const addr = data.address || {};
  const place = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city_district || addr.city;
  const city = addr.city || addr.town || addr.village;
  if (place && city && place !== city) return `${place}, ${city}`;
  return city || place || data.display_name || null;
}

async function geocodePlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const results = await res.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon), label: results[0].display_name };
}

function parseGoogleMapsUrl(input) {
  const atMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) };

  const qMatch = input.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lon: parseFloat(qMatch[2]) };

  const bareLatLon = input.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
  if (bareLatLon) return { lat: parseFloat(bareLatLon[1]), lon: parseFloat(bareLatLon[2]) };

  return null;
}

async function resolveLocation(input) {
  const direct = parseGoogleMapsUrl(input);
  if (direct) return { ...direct, label: input };

  if (/^https?:\/\//.test(input)) {
    // Shortened Google Maps links (maps.app.goo.gl, goo.gl/maps) redirect to a URL
    // containing the coordinates - follow the redirect and parse the final location.
    try {
      const res = await fetch(input, { redirect: 'follow' });
      const finalUrl = res.url;
      const fromRedirect = parseGoogleMapsUrl(finalUrl);
      if (fromRedirect) return { ...fromRedirect, label: input };
    } catch (err) {
      // fall through to geocoding the raw string, which will likely fail too
    }
  }

  const geocoded = await geocodePlace(input);
  if (geocoded) return geocoded;

  return null;
}

module.exports = { reverseGeocode, geocodePlace, parseGoogleMapsUrl, resolveLocation };
