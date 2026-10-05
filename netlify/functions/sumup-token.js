// Netlify Function: sumup-token
// Proxy per scambio codice OAuth2 con SumUp (evita CORS)
// Handler async: richiesto dal runtime Node 24 di Netlify/AWS Lambda

const SUMUP_TOKEN_URL = 'https://api.sumup.com/token';

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return risposta(405, { error: 'Method not allowed' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
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
    const res = await fetch(SUMUP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams(params).toString(),
    });
    const text = await res.text();
    let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text }; }
    return risposta(res.status, parsed);
  } catch (e) {
    return risposta(500, { error: 'proxy_error', message: e.message });
  }
};
