// Netlify Function: chiudi-presenza
// Riceve sendBeacon da ORMIA.html / ORMIA-finance.html quando l'admin chiude l'ultima tab.
// Chiude la presenza aperta di oggi per il dipendente indicato.

var https = require('https');

var SUPABASE_URL    = process.env.SUPABASE_URL;    // es. https://xxx.supabase.co
var SUPABASE_ANON   = process.env.SUPABASE_ANON_KEY;
var SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; // preferibile per update server-side
var ORIGIN = 'https://ormiaofficina.netlify.app';

exports.handler = function(event, context, callback) {
  var headers = {
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return callback(null, { statusCode: 204, headers: headers, body: '' });
  }
  if (event.httpMethod !== 'POST') {
    return callback(null, { statusCode: 405, headers: headers, body: 'Method Not Allowed' });
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    return callback(null, { statusCode: 400, headers: headers, body: 'Bad JSON' });
  }

  var dipId = body.dipId;
  var ora   = body.ora || new Date().toISOString();

  if (!dipId) {
    return callback(null, { statusCode: 400, headers: headers, body: 'dipId mancante' });
  }

  var oggi = ora.split('T')[0];
  var apiKey = SUPABASE_SERVICE || SUPABASE_ANON;

  // PATCH presenze: chiudi quella aperta oggi per questo dipendente
  // Usiamo la REST API di Supabase direttamente
  var supaHost = SUPABASE_URL.replace('https://', '');
  var patchBody = JSON.stringify({ uscita: ora, uscita_automatica: false });

  var options = {
    hostname: supaHost,
    path: '/rest/v1/presenze?dip_id=eq.' + encodeURIComponent(dipId) + '&data=eq.' + oggi + '&uscita=is.null',
    method: 'PATCH',
    headers: {
      'apikey': apiKey,
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(patchBody),
      'Prefer': 'return=minimal',
    },
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      callback(null, {
        statusCode: res.statusCode < 300 ? 200 : res.statusCode,
        headers: headers,
        body: JSON.stringify({ ok: res.statusCode < 300, status: res.statusCode }),
      });
    });
  });

  req.on('error', function(e) {
    callback(null, { statusCode: 500, headers: headers, body: e.message });
  });

  req.write(patchBody);
  req.end();
};
