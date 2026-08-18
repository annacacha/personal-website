module.exports = (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('STRAVA_CLIENT_ID is not set. Add it in Vercel project settings first.');
    return;
  }

  const redirectUri = `https://${req.headers.host}/api/running-buddy/oauth-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  });

  res.writeHead(302, { Location: `https://www.strava.com/oauth/authorize?${params.toString()}` });
  res.end();
};
