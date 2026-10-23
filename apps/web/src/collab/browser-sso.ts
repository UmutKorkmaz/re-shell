/** Public-client authorization code flow. Operator-pinned endpoints; S256 only (RFC 7636/9700). */
export interface BrowserSsoConfig {
  issuer: string;
  clientId: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  endSessionEndpoint?: string;
  redirectUris: string[];
  scope: string;
  requireResponseIssuer: boolean;
}
interface Transaction {
  version: 1;
  createdAt: number;
  state: string;
  verifier: string;
  controlPlaneUrl: string;
  redirectUri: string;
  returnScreen: 'collab' | 'admin';
  config: BrowserSsoConfig;
}
export const SSO_TRANSACTION_KEY = 're-shell.dashboard.oidc.transaction.v1';
const MAX_AGE = 5 * 60_000;
const OAUTH_PARAMS = ['code', 'state', 'iss', 'error', 'error_description', 'error_uri', 'access_token', 'id_token', 'refresh_token', 'token_type', 'expires_in', 'session_state'];

function secureUrl(raw: string): URL {
  const url = new URL(raw);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) ||
      url.username || url.password || url.hash || raw !== raw.trim() || raw.length > 2048) throw new Error('Sign-in requires HTTPS (HTTP loopback staging is allowed).');
  return url;
}
export function validateSsoConfig(value: unknown): BrowserSsoConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid browser sign-in configuration.');
  const c = value as Partial<BrowserSsoConfig>;
  if (typeof c.issuer !== 'string' || typeof c.clientId !== 'string' || !c.clientId || c.clientId.length > 256 || /\s/.test(c.clientId) ||
      typeof c.authorizationEndpoint !== 'string' || typeof c.tokenEndpoint !== 'string' ||
      !Array.isArray(c.redirectUris) || c.redirectUris.length === 0 || c.redirectUris.length > 16 ||
      typeof c.scope !== 'string' || !c.scope || c.scope.length > 1024 || typeof c.requireResponseIssuer !== 'boolean') {
    throw new Error('Invalid browser sign-in configuration.');
  }
  secureUrl(c.issuer);
  for (const endpoint of [c.authorizationEndpoint, c.tokenEndpoint, c.revocationEndpoint, c.endSessionEndpoint].filter((value): value is string => value !== undefined)) if (secureUrl(endpoint).search) throw new Error('Invalid sign-in endpoint.');
  for (const redirect of c.redirectUris) {
    if (typeof redirect !== 'string' || secureUrl(redirect).href !== redirect || OAUTH_PARAMS.some((key) => new URL(redirect).searchParams.has(key))) {
      throw new Error('Invalid sign-in redirect allowlist.');
    }
  }
  return { issuer: c.issuer, clientId: c.clientId, authorizationEndpoint: c.authorizationEndpoint, tokenEndpoint: c.tokenEndpoint,
    ...(c.revocationEndpoint === undefined ? {} : { revocationEndpoint: c.revocationEndpoint }),
    ...(c.endSessionEndpoint === undefined ? {} : { endSessionEndpoint: c.endSessionEndpoint }),
    redirectUris: [...c.redirectUris], scope: c.scope, requireResponseIssuer: c.requireResponseIssuer };
}
function baseUrl(raw: string): string {
  const url = secureUrl(raw);
  if (url.search) throw new Error('The sign-in control plane URL cannot contain query parameters.');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
async function jsonRequest(url: string, fetchImpl: typeof fetch, options: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url, { ...options, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Sign-in request was rejected. Check the provider and control plane configuration.');
    const reader = response.body?.getReader();
    let text = '';
    if (reader) {
      const decoder = new TextDecoder(); let bytes = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 65_536) { await reader.cancel(); throw new Error('Sign-in response is too large.'); }
          text += decoder.decode(part.value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
    }
    try { return JSON.parse(text); } catch { throw new Error('The sign-in service returned invalid JSON.'); }
  } finally { clearTimeout(timer); }
}
export async function loadSsoConfig(controlPlaneUrl: string, fetchImpl: typeof fetch = fetch): Promise<BrowserSsoConfig> {
  const value = await jsonRequest(`${baseUrl(controlPlaneUrl)}/auth/oidc`, fetchImpl);
  if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) throw new Error('Browser sign-in is not configured on this control plane.');
  return validateSsoConfig((value as { data?: unknown }).data);
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function random(cryptoImpl: Crypto): string { return base64url(cryptoImpl.getRandomValues(new Uint8Array(32))); }
function readTransaction(storage: Storage): Transaction {
  const raw = storage.getItem(SSO_TRANSACTION_KEY);
  if (!raw || raw.length > 16_384) throw new Error('This sign-in has no pending transaction. Start sign-in again.');
  let t: Transaction;
  try { t = JSON.parse(raw) as Transaction; } catch { throw new Error('Invalid sign-in transaction. Start sign-in again.'); }
  if (t.version !== 1 || !Number.isSafeInteger(t.createdAt) || !/^[A-Za-z0-9_-]{43}$/.test(t.state) || !/^[A-Za-z0-9_-]{43}$/.test(t.verifier) ||
      typeof t.controlPlaneUrl !== 'string' || typeof t.redirectUri !== 'string' || !['collab', 'admin'].includes(t.returnScreen)) {
    throw new Error('Invalid sign-in transaction. Start sign-in again.');
  }
  t.config = validateSsoConfig(t.config);
  if (baseUrl(t.controlPlaneUrl) !== t.controlPlaneUrl || !t.config.redirectUris.includes(t.redirectUri)) throw new Error('Invalid sign-in transaction binding.');
  return t;
}
export function cleanSsoCallbackUrl(href: string): string {
  const url = new URL(href);
  for (const param of OAUTH_PARAMS) url.searchParams.delete(param);
  url.hash = '';
  return url.href;
}
export function isSsoCallback(href: string): boolean {
  const url = new URL(href);
  return OAUTH_PARAMS.some((key) => url.searchParams.has(key));
}
/** Route the full-page callback to its connection screen before React mounts it. No credential is read here. */
export function ssoCallbackScreen(href: string, storage: Storage): 'collab' | 'admin' | undefined {
  if (!isSsoCallback(href)) return undefined;
  try { return readTransaction(storage).returnScreen; } catch { return 'collab'; }
}
export async function beginSso(input: {
  controlPlaneUrl: string; href: string; storage: Storage; fetchImpl?: typeof fetch; cryptoImpl?: Crypto; now?: number;
}): Promise<string> {
  const cp = baseUrl(input.controlPlaneUrl);
  const config = await loadSsoConfig(cp, input.fetchImpl);
  const current = secureUrl(input.href);
  const callback = config.redirectUris.find((uri) => {
    const url = new URL(uri);
    return url.origin === current.origin && url.pathname === current.pathname && url.search === current.search;
  }) ?? config.redirectUris.find((uri) => {
    const url = new URL(uri); return url.origin === current.origin && url.pathname === current.pathname;
  });
  if (!callback) throw new Error('This dashboard URL is not an allowed sign-in redirect. Ask the operator to register it.');
  const cryptoImpl = input.cryptoImpl ?? globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('Secure browser cryptography is unavailable. Open the dashboard over HTTPS or loopback.');
  const verifier = random(cryptoImpl);
  const state = random(cryptoImpl);
  const challenge = base64url(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const transaction: Transaction = { version: 1, createdAt: input.now ?? Date.now(), state, verifier, controlPlaneUrl: cp,
    redirectUri: callback, returnScreen: current.searchParams.get('screen') === 'admin' ? 'admin' : 'collab', config };
  // Storage is required for a full-page redirect. Fail visibly before leaving if unavailable.
  input.storage.setItem(SSO_TRANSACTION_KEY, JSON.stringify(transaction));
  if (input.storage.getItem(SSO_TRANSACTION_KEY) !== JSON.stringify(transaction)) throw new Error('Sign-in requires tab storage. Enable it and try again.');
  const authorization = new URL(config.authorizationEndpoint);
  authorization.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: callback, response_type: 'code',
    scope: config.scope, state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  return authorization.href;
}
export async function completeSso(input: {
  controlPlaneUrl: string; href: string; storage: Storage; replaceUrl: (url: string) => void; fetchImpl?: typeof fetch; now?: number;
}): Promise<{ accessToken: string; controlPlaneUrl: string; session: BrowserSsoSession }> {
  const current = new URL(input.href);
  let transaction: Transaction | undefined;
  try {
    transaction = readTransaction(input.storage);
  } finally {
    // Consume before any async work; every success and failure is single use.
    try { input.storage.removeItem(SSO_TRANSACTION_KEY); } finally {
      for (const param of OAUTH_PARAMS) current.searchParams.delete(param);
      current.hash = '';
      if (transaction) current.searchParams.set('screen', transaction.returnScreen);
      input.replaceUrl(current.href);
    }
  }
  if (!transaction) throw new Error('Missing sign-in transaction.');
  const response = new URL(input.href);
  const now = input.now ?? Date.now();
  if (now < transaction.createdAt || now - transaction.createdAt > MAX_AGE) throw new Error('Sign-in expired. Start sign-in again.');
  if (baseUrl(input.controlPlaneUrl) !== transaction.controlPlaneUrl) throw new Error('The control plane changed during sign-in. Start again.');
  for (const param of OAUTH_PARAMS) if (response.searchParams.getAll(param).length > 1) throw new Error('Invalid duplicate sign-in response parameters.');
  const clean = new URL(input.href);
  for (const param of OAUTH_PARAMS) clean.searchParams.delete(param);
  clean.hash = '';
  if (clean.href !== transaction.redirectUri || response.hash) throw new Error('The sign-in callback URL did not match the registered redirect.');
  if (response.searchParams.get('state') !== transaction.state) throw new Error('Sign-in state did not match. Start sign-in again.');
  if ((transaction.config.requireResponseIssuer || response.searchParams.has('iss')) && response.searchParams.get('iss') !== transaction.config.issuer) {
    throw new Error('The sign-in issuer did not match.');
  }
  if (response.searchParams.has('error')) throw new Error('The identity provider declined sign-in. Start again when ready.');
  const code = response.searchParams.get('code');
  if (!code || code.length > 4096 || ['access_token', 'id_token', 'refresh_token', 'token_type', 'expires_in'].some((param) => response.searchParams.has(param))) throw new Error('Expected an authorization code, without tokens in the URL.');
  const fetchImpl = input.fetchImpl ?? fetch;
  const config = await loadSsoConfig(transaction.controlPlaneUrl, fetchImpl);
  if (JSON.stringify(config) !== JSON.stringify(transaction.config)) throw new Error('Sign-in configuration changed. Start again.');
  const result = await jsonRequest(config.tokenEndpoint, fetchImpl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, redirect_uri: transaction.redirectUri,
      code, code_verifier: transaction.verifier }).toString() });
  const token = parseTokens(result, now);
  return { accessToken: token.accessToken, controlPlaneUrl: transaction.controlPlaneUrl,
    session: new BrowserSsoSession(config, transaction.controlPlaneUrl, transaction.redirectUri, token, fetchImpl) };
}

interface Tokens { accessToken: string; refreshToken?: string; expiresAt?: number }
function credential(value: unknown): value is string {
  // OAuth credentials must not contain whitespace or control characters.
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' && value.length > 0 && value.length <= 16_384 && !/[\s\u0000-\u001f\u007f]/.test(value);
}
function parseTokens(value: unknown, now: number): Tokens {
  const token = value as { access_token?: unknown; refresh_token?: unknown; token_type?: unknown; expires_in?: unknown } | null;
  if (!token || !credential(token.access_token) || typeof token.token_type !== 'string' || token.token_type.toLowerCase() !== 'bearer') {
    throw new Error('The identity provider did not return a bearer access token.');
  }
  if (token.refresh_token !== undefined && !credential(token.refresh_token)) throw new Error('Invalid refresh credential response.');
  if ((token.expires_in !== undefined || token.refresh_token !== undefined) &&
      (typeof token.expires_in !== 'number' || !Number.isSafeInteger(token.expires_in) || token.expires_in < 1 || token.expires_in > 86_400)) {
    throw new Error('Invalid access token expiry.');
  }
  return { accessToken: token.access_token, ...(typeof token.refresh_token === 'string' ? { refreshToken: token.refresh_token } : {}),
    ...(typeof token.expires_in === 'number' ? { expiresAt: now + token.expires_in * 1000 } : {}) };
}

/** Credentials live only in this page. Never serialize this session or retain ID tokens. */
export class BrowserSsoSession {
  #tokens: Tokens;
  #closed = false;
  #signingOut = false;
  #refreshing: Promise<string> | undefined;
  constructor(readonly config: BrowserSsoConfig, readonly controlPlaneUrl: string, readonly redirectUri: string,
    tokens: Tokens, private readonly fetchImpl: typeof fetch) {
    const pinned = validateSsoConfig(config);
    Object.freeze(pinned.redirectUris);
    this.config = Object.freeze(pinned);
    this.#tokens = tokens;
  }
  get expiresAt(): number | undefined { return this.#tokens.expiresAt; }
  get accessToken(): string { return this.#tokens.accessToken; }
  get canRefresh(): boolean { return !this.#closed && !this.#signingOut && this.#tokens.refreshToken !== undefined; }
  /** Single-flight avoids refresh-token reuse under concurrent callers; failure requires new sign-in. */
  refresh(now = Date.now()): Promise<string> {
    if (this.#refreshing) return this.#refreshing;
    if (this.#closed || this.#signingOut || !this.#tokens.refreshToken) return Promise.reject(new Error('Sign in again to renew this session.'));
    const refreshToken = this.#tokens.refreshToken;
    this.#refreshing = (async () => {
      try {
        const config = await loadSsoConfig(this.controlPlaneUrl, this.fetchImpl);
        if (JSON.stringify(config) !== JSON.stringify(this.config)) throw new Error('Sign-in configuration changed. Start again.');
        if (this.#closed) throw new Error('The sign-in session was closed.');
        const result = await jsonRequest(config.tokenEndpoint, this.fetchImpl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId, refresh_token: refreshToken }).toString() });
        const next = parseTokens(result, now);
        if (!next.expiresAt) throw new Error('Invalid access token expiry.');
        if (this.#closed) throw new Error('The sign-in session was closed.');
        // RFC 6749 permits omission of a replacement refresh token; retain the current one then.
        this.#tokens = { ...next, refreshToken: next.refreshToken ?? refreshToken };
        return next.accessToken;
      } catch {
        this.close();
        throw new Error('Session renewal failed. Sign in again.');
      } finally { this.#refreshing = undefined; }
    })();
    return this.#refreshing;
  }
  close(): void { this.#closed = true; this.#tokens = { accessToken: '' }; }
  /** Local cleanup always succeeds; provider revocation failure is surfaced separately. */
  async signOut(revokeLocalAccess?: (accessToken: string) => Promise<void>): Promise<string | undefined> {
    this.#signingOut = true;
    const previous = this.#tokens;
    // A rotating grant already in flight must settle before revoking its latest credential.
    await this.#refreshing?.catch(() => undefined);
    const tokens = this.#tokens.accessToken ? this.#tokens : previous;
    this.close();
    let failed = false;
    if (revokeLocalAccess && tokens.accessToken) {
      try { await revokeLocalAccess(tokens.accessToken); } catch { failed = true; }
    }
    if (this.config.revocationEndpoint) {
      // Native browser fetch rejects a BrowserSsoSession receiver.
      const fetchImpl = this.fetchImpl;
      for (const [token, hint] of [[tokens.refreshToken, 'refresh_token'], [tokens.accessToken, 'access_token']] as const) {
        if (!token) continue;
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20_000);
        try {
          const response = await fetchImpl(this.config.revocationEndpoint, { method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: this.config.clientId, token, token_type_hint: hint }).toString() });
          await response.body?.cancel();
          if (!response.ok) throw new Error('Provider revocation failed.');
        } catch { failed = true; }
        finally { clearTimeout(timer); }
      }
    }
    if (failed) throw new Error('Local credentials cleared; server or provider revocation failed. Sign out at the provider and ask the operator to revoke remaining access.');
    if (!this.config.endSessionEndpoint) return undefined;
    const url = new URL(this.config.endSessionEndpoint);
    url.search = new URLSearchParams({ client_id: this.config.clientId, post_logout_redirect_uri: this.redirectUri }).toString();
    return url.href;
  }
}
