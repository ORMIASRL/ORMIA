var https = require('https');

var ORIGIN = 'https://ormiaofficina.netlify.app';
var FIC_TOKEN_HOST = 'api-v2.fattureincloud.it';
var FIC_TOKEN_PATH = '/oauth/token';

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

  var code          = body.code;
  var client_id     = body.client_id;
  var client_secret = body.client_secret;
  var redirect_uri  = body.redirect_uri;
  var grant_type    = body.grant_type || 'authorization_code';

  if (!code || !client_id || !client_secret || !redirect_uri) {
    return callback(null, {
      statusCode: 400,
      headers: headers,
      body: JSON.stringify({ error: 'Campi obbligatori: code, client_id, client_secret, redirect_uri' }),
    });
  }

  var payload = JSON.stringify({
    grant_type:    grant_type,
    client_id:     client_id,
    client_secret: client_secret,
    redirect_uri:  redirect_uri,
    code:          code,
  });

  var reqHeaders = {
    'Content-Type':   'application/json',
    'Accept':         'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };

  var options = {
    hostname: FIC_TOKEN_HOST,
    path:     FIC_TOKEN_PATH,
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
