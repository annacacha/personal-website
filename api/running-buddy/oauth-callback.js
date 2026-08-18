function page(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#14151A; --muted:#6B6E7B; --rule:#E3E3E9; --accent:#C2571B;
  --paper:#FFFFFF; --wash:#F6F6F9;
  --serif:"Fraunces",Georgia,serif;
  --sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
}
*{box-sizing:border-box;}
body{margin:0;background:var(--wash);color:var(--ink);font-family:var(--sans);display:flex;align-items:center;justify-content:center;min-height:100vh;-webkit-font-smoothing:antialiased;}
.card{background:var(--paper);padding:40px 36px;width:100%;max-width:520px;border-radius:4px;box-shadow:0 1px 2px rgba(20,21,26,.06),0 8px 24px rgba(20,21,26,.06);}
h1{font-family:var(--serif);font-variation-settings:"SOFT" 0,"WONK" 1;font-weight:600;font-size:22px;letter-spacing:-0.02em;margin:0 0 14px;}
p{font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 14px;}
code.box{display:block;font-family:var(--mono);font-size:13px;background:var(--wash);border:1px solid var(--rule);border-radius:2px;padding:12px 14px;word-break:break-all;margin:0 0 14px;color:var(--ink);}
.warn{font-size:12.5px;color:#B4232A;}
a{color:var(--accent);}
</style>
</head>
<body>
<div class="card">${bodyHtml}</div>
</body>
</html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const { code, error } = req.query || {};

  if (error) {
    res.status(400).send(page('Authorization declined', `
      <h1>Authorization declined</h1>
      <p>Strava reported: <strong>${error}</strong>. No tokens were issued. You can close this tab and try again from /api/running-buddy/authorize.</p>
    `));
    return;
  }

  if (!code) {
    res.status(400).send(page('Missing code', `<h1>Missing authorization code</h1><p>This page should only be visited via Strava's redirect after authorizing.</p>`));
    return;
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).send(page('Missing config', `<h1>Missing config</h1><p>STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set in Vercel yet.</p>`));
    return;
  }

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      res.status(502).send(page('Strava error', `<h1>Strava rejected the exchange</h1><p class="warn">${text}</p>`));
      return;
    }

    const data = await tokenRes.json();
    const athleteName = data.athlete ? `${data.athlete.firstname || ''} ${data.athlete.lastname || ''}`.trim() : 'unknown athlete';

    res.status(200).send(page('Connected', `
      <h1>Connected as ${athleteName}</h1>
      <p>Copy this refresh token into your Vercel project's Environment Variables as <strong>STRAVA_REFRESH_TOKEN</strong>, then redeploy. This page won't show it again.</p>
      <code class="box">${data.refresh_token}</code>
      <p class="warn">Treat this like a password &mdash; don't paste it anywhere else or share a screenshot of this page.</p>
    `));
  } catch (err) {
    res.status(500).send(page('Error', `<h1>Something went wrong</h1><p class="warn">${String(err)}</p>`));
  }
};
