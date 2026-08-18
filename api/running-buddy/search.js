const { stravaFetch } = require('../../lib/strava');
const { resolveLocation } = require('../../lib/geocode');

const TARGETS = [
  { key: '5k', meters: 5000, radiusKm: 4 },
  { key: '10k', meters: 10000, radiusKm: 7 },
  { key: '15k', meters: 15000, radiusKm: 10 },
];

function boundsAround(lat, lon, radiusKm) {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return [lat - latDelta, lon - lonDelta, lat + latDelta, lon + lonDelta].join(',');
}

async function exploreSegments(lat, lon, radiusKm) {
  const data = await stravaFetch('/segments/explore', {
    bounds: boundsAround(lat, lon, radiusKm),
    activity_type: 'running',
  });
  return data.segments || [];
}

async function withDetails(segment) {
  try {
    const detail = await stravaFetch(`/segments/${segment.id}`);
    return {
      id: segment.id,
      name: segment.name,
      distanceKm: Math.round((segment.distance / 1000) * 10) / 10,
      elevationM: Math.round(segment.elev_difference),
      avgGrade: segment.avg_grade,
      startLatLng: segment.start_latlng,
      endLatLng: segment.end_latlng,
      polyline: segment.points,
      effortCount: detail.effort_count || 0,
      athleteCount: detail.athlete_count || 0,
      starred: !!segment.starred,
    };
  } catch (err) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const location = (req.query && req.query.location) || '';
  if (!location.trim()) {
    res.status(400).json({ error: 'Missing "location" query parameter.' });
    return;
  }

  try {
    const resolved = await resolveLocation(location.trim());
    if (!resolved) {
      res.status(404).json({ error: `Could not find a location for "${location}".` });
      return;
    }

    const results = [];
    for (const target of TARGETS) {
      const candidates = await exploreSegments(resolved.lat, resolved.lon, target.radiusKm);

      const inTolerance = candidates.filter(
        (s) => s.distance >= target.meters * 0.7 && s.distance <= target.meters * 1.3
      );
      const pool = inTolerance.length ? inTolerance : candidates;
      const shortlist = [...pool]
        .sort((a, b) => Math.abs(a.distance - target.meters) - Math.abs(b.distance - target.meters))
        .slice(0, 6);

      const detailed = (await Promise.all(shortlist.map(withDetails))).filter(Boolean);
      const ranked = detailed.sort((a, b) => b.effortCount - a.effortCount).slice(0, 3);

      results.push({
        target: target.key,
        targetMeters: target.meters,
        approximate: inTolerance.length === 0,
        segments: ranked,
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.status(200).json({
      location: { lat: resolved.lat, lon: resolved.lon, label: resolved.label },
      results,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};
