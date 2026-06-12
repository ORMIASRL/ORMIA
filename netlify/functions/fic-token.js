var https = require('https');

var ORIGIN = 'https://ormiaofficina.netlify.app';

exports.handler = function(event, context, callback) {
  var headers = {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return callback(null, { statusCode: 200, headers: headers, body: '' });
  }
  if (event.httpMethod !== 'POST') {
    return callback(null, { statusCode: 405, body: 'Method Not Allowed' });
  }

  var body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) {}

  // Converti JSON in form-encoded (standard OAuth2)
  var parts = [];
  var keys = Object.keys(body);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (body[k] !== null && body[k] !== undefined && body[k] !== '') {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(body[k]));
    }
  }
  var formBody = parts.join('&');

  var options = {
    hostname: 'api-v2.fattureincloud.it',
    path: '/oauth/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formBody)
    }
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      var parsed;
      try { parsed = JSON.parse(data); } catch(e) { parsed = { error: 'parse_error', raw: data }; }
      callback(null, {
        statusCode: res.statusCode,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ORIGIN },
        body: JSON.stringify(parsed)
      });
    });
  });

  req.on('error', function(e) {
    callback(null, {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': ORIGIN },
      body: JSON.stringify({ error: 'proxy_error', error_description: e.message })
    });
  });

  req.write(formBody);
  req.end();
};
