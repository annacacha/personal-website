const PASSCODE = '2026';
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const wantsJson = (req.headers.accept || '').includes('application/json');
  const body = req.body || {};
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (code === PASSCODE) {
    res.setHeader(
      'Set-Cookie',
      `cv_auth=unlocked; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
    );
    if (wantsJson) {
      res.status(200).json({ ok: true });
      return;
    }
    res.writeHead(302, { Location: '/cv' });
    res.end();
    return;
  }

  if (wantsJson) {
    res.status(401).json({ ok: false });
    return;
  }
  res.writeHead(302, { Location: '/cv?error=1' });
  res.end();
};
