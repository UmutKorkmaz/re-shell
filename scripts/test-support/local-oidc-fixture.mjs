// TEST ONLY: a loopback protocol fixture, without user authentication. Never deploy this as an IdP.
import http from 'node:http';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

export async function startLocalOidcFixture({ redirectUris, clientId = 're-shell-dashboard', audience = 're-shell-api', port = 0 }) {
  const redirects = new Set(redirectUris);
  const origins = new Set(redirectUris.map((uri) => new URL(uri).origin));
  for (const uri of redirectUris) {
    const url = new URL(uri);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Fixture redirects must be HTTP loopback.');
  }
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture-k1', alg: 'RS256', use: 'sig' }] };
  const requests = new Map();
  const codes = new Map();
  let issuer;
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  const body = async (req) => {
    let text = '';
    for await (const chunk of req) { text += chunk.toString(); if (text.length > 16_384) throw new Error('oversized'); }
    return new URLSearchParams(text);
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(); return; }
    try {
      const url = new URL(req.url, issuer);
      if (req.method === 'GET' && url.pathname === '/authorize') {
        const p = url.searchParams;
        if (p.get('client_id') !== clientId || !redirects.has(p.get('redirect_uri')) || p.get('response_type') !== 'code' ||
            p.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(p.get('code_challenge') ?? '') ||
            !/^[A-Za-z0-9_-]{43}$/.test(p.get('state') ?? '')) { json(res, 400, { error: 'invalid_request' }); return; }
        const id = randomBytes(32).toString('base64url');
        requests.set(id, { redirectUri: p.get('redirect_uri'), challenge: p.get('code_challenge'), state: p.get('state'), expires: Date.now() + 60_000 });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${[...origins].join(' ')}; frame-ancestors 'none'`, 'Cache-Control': 'no-store' });
        res.end(`<!doctype html><html lang="en"><head><title>Local Re-Shell test identity</title><meta name="viewport" content="width=device-width"></head><body style="font-family:system-ui;background:#101418;color:#edf2f5;padding:3rem;max-width:38rem;margin:auto"><h1>Local identity fixture</h1><p>This test-only provider exercises authorization code and PKCE. It does not authenticate a real account.</p><form method="post" action="/approve"><input type="hidden" name="request" value="${id}"><button style="padding:1rem;font-size:1rem" type="submit">Continue as staging Alice</button></form></body></html>`);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/approve') {
        const p = await body(req); const pending = requests.get(p.get('request')); requests.delete(p.get('request'));
        if (!pending || pending.expires < Date.now()) { json(res, 400, { error: 'invalid_request' }); return; }
        const code = randomBytes(32).toString('base64url'); codes.set(code, pending);
        const callback = new URL(pending.redirectUri); callback.searchParams.set('code', code); callback.searchParams.set('state', pending.state); callback.searchParams.set('iss', issuer);
        res.writeHead(303, { Location: callback.href, 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (req.method === 'POST' && url.pathname === '/token') {
        if (origin && !origins.has(origin)) { json(res, 403, { error: 'invalid_request' }); return; }
        const p = await body(req); const pending = codes.get(p.get('code')); codes.delete(p.get('code'));
        if (!pending || pending.expires < Date.now() || p.get('grant_type') !== 'authorization_code' || p.get('client_id') !== clientId ||
            p.get('redirect_uri') !== pending.redirectUri || !/^[A-Za-z0-9_-]{43}$/.test(p.get('code_verifier') ?? '') ||
            createHash('sha256').update(p.get('code_verifier')).digest('base64url') !== pending.challenge) { json(res, 400, { error: 'invalid_grant' }); return; }
        const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const unsigned = `${encode({ alg: 'RS256', typ: 'at+jwt', kid: 'fixture-k1' })}.${encode({ iss: issuer, sub: 'staging-alice', aud: audience, iat: now, exp: now + 300 })}`;
        json(res, 200, { access_token: `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`,
          token_type: 'Bearer', expires_in: 300, id_token: 'fixture-id-token-must-never-be-used', refresh_token: 'fixture-refresh-token-must-never-be-stored' });
        return;
      }
      json(res, 404, { error: 'not_found' });
    } catch { json(res, 400, { error: 'invalid_request' }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  issuer = `http://127.0.0.1:${server.address().port}`;
  const prune = setInterval(() => {
    for (const map of [requests, codes]) for (const [key, value] of map) if (value.expires < Date.now()) map.delete(key);
  }, 30_000); prune.unref();
  return { issuer, jwks, audience, clientId, subject: 'staging-alice',
    browserConfig: { issuer, clientId, authorizationEndpoint: `${issuer}/authorize`, tokenEndpoint: `${issuer}/token`, redirectUris, scope: 'openid', requireResponseIssuer: true },
    close: async () => { clearInterval(prune); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); } };
}
