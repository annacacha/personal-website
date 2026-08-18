const { fetchAllActivities } = require('../../lib/strava');
const { countryAt } = require('../../lib/countries');
const { reverseGeocode } = require('../../lib/geocode');

function isRun(activity) {
  return activity.type === 'Run' || activity.sport_type === 'Run' || activity.sport_type === 'TrailRun';
}

function metersToKm(m) {
  return Math.round((m / 1000) * 10) / 10;
}

function paceMinPerKm(distanceM, movingTimeS) {
  const minutes = movingTimeS / 60 / (distanceM / 1000);
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return `${whole}:${String(seconds).padStart(2, '0')}`;
}

function summarize(activity) {
  return {
    id: activity.id,
    name: activity.name,
    date: activity.start_date_local,
    distanceKm: metersToKm(activity.distance),
    elevationM: Math.round(activity.total_elevation_gain),
    pace: paceMinPerKm(activity.distance, activity.moving_time),
  };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const activities = (await fetchAllActivities({ maxPages: 10 })).filter(isRun);

    const year = new Date().getFullYear();
    const thisYearRuns = activities.filter((a) => new Date(a.start_date_local).getFullYear() === year);

    const longestRun = thisYearRuns.reduce((best, a) => (!best || a.distance > best.distance ? a : best), null);
    const mostElevation = thisYearRuns.reduce((best, a) => (!best || a.total_elevation_gain > best.total_elevation_gain ? a : best), null);
    const eligibleForPace = thisYearRuns.filter((a) => a.distance >= 5000);
    const fastestPace = eligibleForPace.reduce((best, a) => (!best || a.average_speed > best.average_speed ? a : best), null);

    const totalDistanceKm = Math.round(thisYearRuns.reduce((sum, a) => sum + a.distance, 0) / 1000);

    const withGps = activities.filter((a) => Array.isArray(a.start_latlng) && a.start_latlng.length === 2);

    const countrySet = new Set();
    withGps.forEach((a) => {
      const [lat, lng] = a.start_latlng;
      const country = countryAt(lat, lng);
      if (country) countrySet.add(country);
    });

    const cellCounts = new Map();
    withGps.forEach((a) => {
      const [lat, lng] = a.start_latlng;
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      const entry = cellCounts.get(key) || { count: 0, lat, lng };
      entry.count += 1;
      cellCounts.set(key, entry);
    });

    const topCells = [...cellCounts.values()].sort((a, b) => b.count - a.count).slice(0, 3);

    const favouritePlaces = [];
    for (const [index, cell] of topCells.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100)); // respect Nominatim's 1 req/sec policy
      let placeName = null;
      try {
        placeName = await reverseGeocode(cell.lat, cell.lng);
      } catch (err) {
        placeName = null;
      }
      favouritePlaces.push({ name: placeName || `${cell.lat.toFixed(2)}, ${cell.lng.toFixed(2)}`, runs: cell.count });
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({
      year,
      thisYear: {
        totalRuns: thisYearRuns.length,
        totalDistanceKm,
        longestRun: longestRun ? summarize(longestRun) : null,
        mostElevation: mostElevation ? summarize(mostElevation) : null,
        fastestPace: fastestPace ? summarize(fastestPace) : null,
      },
      lifetime: {
        countryCount: countrySet.size,
        countries: [...countrySet].sort(),
        favouritePlaces,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
};
