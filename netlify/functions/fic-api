var https = require('https');

var ORIGIN  = 'https://ormiaofficina.netlify.app';
var FIC_BASE = 'api.fattureincloud.it';

exports.handler = function(event, context, callback) {
  var headers = {
    'Access-Control-Allow-Origin':  ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return callback(null, { statusCode: 200, headers: headers, body: '' });
  }

  var body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) {}

  var token   = body.token;
  var path    = body.path;    // es. /c/1603640/issued_documents?type=invoice...
  var method  = body.method  || 'GET';
  var payload = body.payload ? JSON.stringify(body.payload) : '';

  if (!token || !path) {
    return callback(null, { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'token e path obbligatori' }) });
  }

  var reqHeaders = {
    'Authorization': 'Bearer ' + token,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
  };
  if (payload) reqHeaders['Content-Length'] = Buffer.byteLength(payload);

  var options = {
    hostname: FIC_BASE,
    path:     '/v2' + path,
    method:   method,
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

  if (payload) req.write(payload);
  req.end();
};
