let cachedToken = null; // { accessToken, expiresAt } - reused within a warm function instance only

async function getAccessToken() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Strava environment variables are not configured (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN).');
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.accessToken;
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: data.expires_at };
  return cachedToken.accessToken;
}

async function stravaFetch(path, params) {
  const accessToken = await getAccessToken();
  const url = new URL(`https://www.strava.com/api/v3${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava API ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function fetchAllActivities({ maxPages = 10, perPage = 200 } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await stravaFetch('/athlete/activities', { page, per_page: perPage });
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}

module.exports = { getAccessToken, stravaFetch, fetchAllActivities };
