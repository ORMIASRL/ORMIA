const https = require('https');
const querystring = require('querystring');

const CORS = { 'Access-Control-Allow-Origin': 'https://ormiaofficina.netlify.app' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const formBody = querystring.stringify(
      Object.fromEntries(Object.entries(body).filter(([, v]) => v != null && v !== ''))
    );

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api-v2.fattureincloud.it',
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formBody)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(formBody);
      req.end();
    });

    let data;
    try { data = JSON.parse(result.body); } catch (_) { data = { error: 'parse_error', raw: result.body }; }

    return {
      statusCode: result.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'proxy_error', error_description: e.message })
    };
  }
};
