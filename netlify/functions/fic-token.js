// Netlify Function: fic-token
// 1) Scambio/rinnovo token OAuth2 con Fatture in Cloud
// 2) Proxy per le chiamate API FiC (le API FiC non accettano chiamate dirette dal browser - CORS)
// Handler async: richiesto dal runtime Node 24 di Netlify/AWS Lambda

const FIC_TOKEN_URL = 'https://api-v2.fattureincloud.it/oauth/token';
const FIC_API_BASE  = 'https://api-v2.fattureincloud.it';

const CORS = {
  'Access-Control-Allow-Origin':  'https://ormiaofficinapro.netlify.app',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const risposta = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...CORS },
  body: JSON.stringify(obj),
});
const leggi = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { raw: text }; }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return risposta(405, { error: 'Method not allowed' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}

  // ── Modalità proxy API: { api_path, api_method, api_body, access_token } ──
  if (body.api_path) {
    const path = String(body.api_path);
    if (!path.startsWith('/') || path.includes('://') || path.includes('..'))
      return risposta(400, { error: 'api_path non valido' });
    if (!body.access_token) return risposta(401, { error: 'access_token mancante' });
    const method = String(body.api_method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return risposta(400, { error: 'metodo non valido' });
    try {
      const res = await fetch(FIC_API_BASE + path, {
        method,
        headers: {
          'Authorization': 'Bearer ' + body.access_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: method === 'GET' || method === 'DELETE' || body.api_body == null ? undefined : JSON.stringify(body.api_body),
      });
      return risposta(res.status, await leggi(res));
    } catch (e) {
      return risposta(502, { error: 'proxy_error', message: e.message });
    }
  }

  // ── Modalità token OAuth2 ──
  const { client_id, client_secret, redirect_uri, code, refresh_token } = body;
  const grant_type = body.grant_type || 'authorization_code';
  let params;
  if (grant_type === 'refresh_token') {
    if (!client_id || !client_secret || !refresh_token)
      return risposta(400, { error: 'client_id, client_secret e refresh_token obbligatori' });
    params = { grant_type, client_id, client_secret, refresh_token };
  } else {
    if (!code || !client_id || !client_secret || !redirect_uri)
      return risposta(400, { error: 'code, client_id, client_secret e redirect_uri obbligatori' });
    params = { grant_type: 'authorization_code', client_id, client_secret, redirect_uri, code };
  }
  try {
    const res = await fetch(FIC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams(params).toString(),
    });
    return risposta(res.status, await leggi(res));
  } catch (e) {
    return risposta(500, { error: 'proxy_error', message: e.message });
  }
};
