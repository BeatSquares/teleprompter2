/**
 * BTSQ Teleprompter: Upload-Relay nach Google Drive.
 *
 * Die Web-App nimmt Aufnahmen in Teilen entgegen und schreibt sie per
 * Resumable Upload in den Ordner FOLDER_ID (Shared Drive "BeatSquares").
 * Wer aufnimmt, braucht kein Google-Konto, nur den Upload-Schlüssel aus dem Einladungslink.
 *
 * Einrichten (einmalig, ca. 3 Minuten):
 * 1. script.google.com > Neues Projekt > diesen Code einfügen > speichern.
 * 2. Bereitstellen > Neue Bereitstellung > Typ "Web-App"
 *    Ausführen als: Ich  ·  Zugriff: Jeder
 * 3. Zugriff erlauben (Drive, externe Anfragen).
 * 4. Die /exec-Adresse in index.html bei CONFIG.endpoint eintragen.
 */

const FOLDER_ID = 'ORDNER_ID';     // Drive-Ordner, in den die Aufnahmen sollen
const UPLOAD_KEY = 'SCHLUESSEL';     // gleicher Wert wie im Einladungslink (#k=...)
const MAX_BYTES = 500 * 1024 * 1024;
const SESSION_RE = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/;

function doGet(e) {
  if (!e || !e.parameter || e.parameter.k !== UPLOAD_KEY) return json_({ ok: false, error: 'key' });
  return json_({ ok: true, folder: DriveApp.getFolderById(FOLDER_ID).getName() });
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (p.key !== UPLOAD_KEY) return json_({ ok: false, error: 'key' });
    switch (p.action) {
      case 'start': return json_(start_(p));
      case 'chunk': return json_(chunk_(p));
      case 'status': return json_(status_(p));
      case 'meta': return json_(meta_(p));
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err).slice(0, 300) });
  }
}

function start_(p) {
  const size = Number(p.size);
  const mime = String(p.mimeType || '');
  if (!/^video\/(mp4|webm|quicktime)$/.test(mime)) return { ok: false, error: 'mime' };
  if (!(size > 0 && size <= MAX_BYTES)) return { ok: false, error: 'size' };
  const meta = { name: cleanName_(p.name), parents: [FOLDER_ID], mimeType: mime, description: String(p.description || '').slice(0, 1000) };
  const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    payload: JSON.stringify(meta),
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) },
    muteHttpExceptions: true,
    followRedirects: false
  });
  if (r.getResponseCode() !== 200) return { ok: false, error: 'start ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200) };
  const h = r.getAllHeaders();
  const session = h.Location || h.location;
  if (!session) return { ok: false, error: 'no session' };
  return { ok: true, session: session };
}

function chunk_(p) {
  if (!SESSION_RE.test(String(p.session))) return { ok: false, error: 'session' };
  const bytes = Utilities.base64Decode(String(p.data || ''));
  const start = Number(p.start), total = Number(p.total);
  if (!bytes.length || !(start >= 0) || !(total > 0) || start + bytes.length > total) return { ok: false, error: 'range' };
  const r = UrlFetchApp.fetch(p.session, {
    method: 'put',
    payload: bytes,
    contentType: 'application/octet-stream',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes ' + start + '-' + (start + bytes.length - 1) + '/' + total },
    muteHttpExceptions: true,
    followRedirects: false
  });
  return result_(r);
}

function status_(p) {
  if (!SESSION_RE.test(String(p.session))) return { ok: false, error: 'session' };
  const r = UrlFetchApp.fetch(p.session, {
    method: 'put',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes */' + Number(p.total) },
    muteHttpExceptions: true,
    followRedirects: false
  });
  return result_(r);
}

function result_(r) {
  const code = r.getResponseCode();
  if (code === 200 || code === 201) {
    const f = JSON.parse(r.getContentText());
    return { ok: true, done: true, id: f.id, url: f.webViewLink || ('https://drive.google.com/file/d/' + f.id + '/view') };
  }
  if (code === 308) {
    const h = r.getAllHeaders();
    const range = h.Range || h.range || '';
    const m = /bytes=0-(\d+)/.exec(range);
    return { ok: true, done: false, next: m ? Number(m[1]) + 1 : 0 };
  }
  return { ok: false, error: 'drive ' + code + ' ' + r.getContentText().slice(0, 200) };
}

function meta_(p) {
  const text = String(p.text || '');
  if (text.length > 200000) return { ok: false, error: 'size' };
  const f = DriveApp.getFolderById(FOLDER_ID).createFile(cleanName_(p.name), text, 'application/json');
  return { ok: true, id: f.getId() };
}

function cleanName_(n) {
  return String(n || 'aufnahme').replace(/[^\w.\-]+/g, '_').slice(0, 120);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
