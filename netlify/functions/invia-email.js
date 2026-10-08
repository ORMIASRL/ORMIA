// Invio email con allegato PDF tramite la casella dell'officina (SMTP SSL).
// Solo utenti autenticati del gestionale. La password SMTP sta nella variabile d'ambiente Netlify SMTP_PASS.
var tls = require('tls');

var SUPA_URL  = 'https://crcfwmkemnwippplteqm.supabase.co';
var SMTP_HOST = process.env.SMTP_HOST || 'smtp.totalcom.it';
var SMTP_PORT = +(process.env.SMTP_PORT || 465);
var SMTP_USER = process.env.SMTP_USER || 'officina@officinaormia.it';
var FROM_NAME = process.env.SMTP_FROM_NAME || 'ORMIA SNC - Officina';

function json(code, obj) { return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }; }
function b64(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function wrap(s) { return String(s).replace(/(.{76})/g, '$1\r\n'); }
function encH(s) { return /^[\x20-\x7E]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?='; }
function okMail(e) { return /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[a-z]{2,}$/i.test(String(e || '')); }

function smtp(cmds) {
  return new Promise(function (resolve, reject) {
    var sock = tls.connect(SMTP_PORT, SMTP_HOST, { servername: SMTP_HOST });
    var buf = '', i = 0, done = false;
    var t = setTimeout(function () { fail(new Error('timeout del server di posta')); }, 9000);
    function fail(e) { if (done) return; done = true; clearTimeout(t); try { sock.destroy(); } catch (_) {} reject(e); }
    sock.on('error', fail);
    sock.on('data', function (d) {
      buf += d.toString('utf8');
      var lines = buf.split('\r\n'); if (lines[lines.length - 1] !== '') return;
      var last = lines[lines.length - 2] || '';
      if (!/^\d{3} /.test(last) && !/^\d{3}$/.test(last)) return; // risposta multilinea non finita
      var code = +last.slice(0, 3), step = cmds[i], resp = buf; buf = '';
      if (step.expect.indexOf(code) < 0) { var m = step.label === 'AUTH' ? 'credenziali SMTP rifiutate (controlla SMTP_PASS su Netlify)' : 'il server di posta ha risposto: ' + resp.trim().slice(0, 200); return fail(new Error(m)); }
      i++;
      if (i >= cmds.length) { done = true; clearTimeout(t); sock.end(); return resolve(); }
      sock.write(cmds[i].send);
    });
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'metodo non consentito' });
  var b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'richiesta non valida' }); }

  // Solo utenti loggati nel gestionale
  var hd = event.headers || {};
  var tok = String(hd.authorization || hd.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok || !b.apikey) return json(401, { error: 'accesso negato' });
  try {
    var u = await fetch(SUPA_URL + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + tok, apikey: b.apikey } });
    if (!u.ok) return json(401, { error: 'sessione non valida: rientra nel gestionale' });
  } catch (e) { return json(502, { error: 'verifica utente non riuscita' }); }

  var pass = process.env.SMTP_PASS;
  if (!pass) return json(500, { error: 'password email non configurata (variabile SMTP_PASS su Netlify)' });

  var to = String(b.to || '').trim();
  if (!okMail(to)) return json(400, { error: 'indirizzo email non valido' });
  var subject = String(b.subject || 'Documento').slice(0, 200).replace(/[\r\n]+/g, ' ');
  var text = String(b.text || '').slice(0, 20000);
  var att = b.attachment && b.attachment.data ? b.attachment : null;
  if (att && String(att.data).length > 5500000) return json(413, { error: 'allegato troppo grande' });
  var fname = att ? String(att.name || 'documento.pdf').replace(/[^\w.\- ]/g, '_').slice(0, 80) : '';

  var bnd = 'ormia_' + Date.now().toString(36);
  var msg = [
    'From: ' + encH(FROM_NAME) + ' <' + SMTP_USER + '>',
    'To: <' + to + '>',
    'Reply-To: <' + SMTP_USER + '>',
    'Subject: ' + encH(subject),
    'Date: ' + new Date().toUTCString(),
    'Message-ID: <' + bnd + '@officinaormia.it>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + bnd + '"',
    '',
    '--' + bnd,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(text.replace(/\r?\n/g, '\r\n'))),
  ];
  if (att) msg.push('--' + bnd,
    'Content-Type: application/pdf; name="' + fname + '"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="' + fname + '"',
    '',
    wrap(String(att.data).replace(/[^A-Za-z0-9+/=]/g, '')));
  msg.push('--' + bnd + '--', '');
  var data = msg.join('\r\n').replace(/\r\n\./g, '\r\n..');

  // copia nascosta all'officina, così resta traccia dell'invio
  var rcpt = [to]; if (b.copia !== false && to.toLowerCase() !== SMTP_USER.toLowerCase()) rcpt.push(SMTP_USER);
  var cmds = [
    { send: null, expect: [220] },
    { send: 'EHLO officinaormia.it\r\n', expect: [250] },
    { send: 'AUTH LOGIN\r\n', expect: [334] },
    { send: b64(SMTP_USER) + '\r\n', expect: [334] },
    { send: b64(pass) + '\r\n', expect: [235], label: 'AUTH' },
    { send: 'MAIL FROM:<' + SMTP_USER + '>\r\n', expect: [250] },
  ];
  rcpt.forEach(function (r) { cmds.push({ send: 'RCPT TO:<' + r + '>\r\n', expect: [250, 251] }); });
  cmds.push({ send: 'DATA\r\n', expect: [354] }, { send: data + '\r\n.\r\n', expect: [250] }, { send: 'QUIT\r\n', expect: [221] });

  try { await smtp(cmds); return json(200, { ok: true }); }
  catch (e) { return json(502, { error: e.message }); }
};
