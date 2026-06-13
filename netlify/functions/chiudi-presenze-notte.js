// Netlify Scheduled Function: chiudi-presenze-notte
// Gira ogni giorno alle 20:30 (cron: "30 20 * * *")
// Chiude tutte le presenze ancora aperte usando l'ora_uscita_automatica del dipendente.
// Fallback per admin che spengono PC senza che il beacon sia arrivato,
// e per meccanici/magazzino che non hanno timbrato uscita.

// netlify.toml:
// [[plugins]]
// package = "@netlify/plugin-functions-install-core"
//
// [functions.chiudi-presenze-notte]
// schedule = "30 20 * * *"

var https = require('https');

var SUPABASE_URL     = process.env.SUPABASE_URL;
var SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function supaGet(path, callback) {
  var host = SUPABASE_URL.replace('https://', '');
  var options = {
    hostname: host,
    path: '/rest/v1/' + path,
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE,
      'Content-Type': 'application/json',
    },
  };
  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      try { callback(null, JSON.parse(data)); }
      catch(e) { callback(e); }
    });
  });
  req.on('error', callback);
  req.end();
}

function supaPatch(path, body, callback) {
  var host = SUPABASE_URL.replace('https://', '');
  var bodyStr = JSON.stringify(body);
  var options = {
    hostname: host,
    path: '/rest/v1/' + path,
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      'Prefer': 'return=minimal',
    },
  };
  var req = https.request(options, function(res) {
    res.on('data', function() {});
    res.on('end', function() { callback(null, res.statusCode); });
  });
  req.on('error', callback);
  req.write(bodyStr);
  req.end();
}

exports.handler = function(event, context, callback) {
  var oggi = new Date().toISOString().split('T')[0];

  // 1. Carica dipendenti per avere ora_uscita_automatica
  supaGet('meccanici?select=id,ora_uscita_automatica', function(err, meccanici) {
    if (err) return callback(null, { statusCode: 500, body: err.message });

    // Mappa dipId → ora uscita
    var oraMap = {};
    (meccanici || []).forEach(function(m) {
      oraMap[m.id] = m.ora_uscita_automatica || '20:00';
    });

    // 2. Carica presenze aperte oggi
    supaGet('presenze?data=eq.' + oggi + '&uscita=is.null&select=id,dip_id', function(err2, presenze) {
      if (err2) return callback(null, { statusCode: 500, body: err2.message });

      var pending = (presenze || []).length;
      if (!pending) return callback(null, { statusCode: 200, body: 'Nessuna presenza aperta.' });

      var done = 0;
      var errors = 0;

      (presenze || []).forEach(function(p) {
        var dipId = p.dip_id;
        var oraStr = oraMap[dipId] || '20:00';
        var parts = oraStr.split(':');
        var hh = parseInt(parts[0]) || 20;
        var mm = parseInt(parts[1]) || 0;
        var uscitaDate = new Date();
        uscitaDate.setHours(hh, mm, 0, 0);
        var uscita = uscitaDate.toISOString();

        supaPatch(
          'presenze?id=eq.' + p.id,
          { uscita: uscita, uscita_automatica: true },
          function(e) {
            if (e) errors++;
            done++;
            if (done === pending) {
              callback(null, {
                statusCode: 200,
                body: JSON.stringify({ chiuse: pending - errors, errori: errors }),
              });
            }
          }
        );
      });
    });
  });
};
