// Netlify Function: sumup-token
// Proxy per scambio codice OAuth2 con SumUp
// Evita CORS — il browser non può chiamare il token endpoint SumUp direttamente

var https = require('https');

var ORIGIN       = 'https://ormiaofficina.netlify.app';
var SUMUP_HOST   = 'api.sumup.com';
var SUMUP_PATH   = '/token';

exports.handler = function(event, context, callback) {
  var headers = {
    'Access-Control-Allow-Origin':  ORIGIN,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return callback(null, { statusCode: 200, headers: headers, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return callback(null, { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) });
  }

  var body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) {}

  var grant_type    = body.grant_type || 'authorization_code';
  var client_id     = body.client_id;
  var client_secret = body.client_secret;
  var redirect_uri  = body.redirect_uri;
  var code          = body.code;
  var refresh_token = body.refresh_token;

  var payload;
  if (grant_type === 'refresh_token') {
    if (!client_id || !client_secret || !refresh_token) {
      return callback(null, { statusCode: 400, headers: headers,
        body: JSON.stringify({ error: 'client_id, client_secret e refresh_token obbligatori' }) });
    }
    payload = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     client_id,
      client_secret: client_secret,
      refresh_token: refresh_token,
    }).toString();
  } else {
    if (!code || !client_id || !client_secret || !redirect_uri) {
      return callback(null, { statusCode: 400, headers: headers,
        body: JSON.stringify({ error: 'code, client_id, client_secret e redirect_uri obbligatori' }) });
    }
    payload = new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     client_id,
      client_secret: client_secret,
      redirect_uri:  redirect_uri,
      code:          code,
    }).toString();
  }

  var reqHeaders = {
    'Content-Type':   'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(payload),
    'Accept':         'application/json',
  };

  var options = {
    hostname: SUMUP_HOST,
    path:     SUMUP_PATH,
    method:   'POST',
    headers:  reqHeaders,
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      var parsed;
      try { parsed = JSON.parse(data); } catch(e) { parsed = { raw: data }; }
      callback(null, {
        statusCode: res.statusCode,
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify(parsed),
      });
    });
  });

  req.on('error', function(e) {
    callback(null, {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: 'proxy_error', message: e.message }),
    });
  });

  req.write(payload);
  req.end();
};
