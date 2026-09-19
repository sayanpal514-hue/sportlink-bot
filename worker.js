// ================================================================
//  Sportlink-Bot — All Playlists, unified pipe output
//    <url>|Cookie=<c>&Referer=<r>&Origin=<o>[&drmScheme=clearkey&drmLicense=<d>]
//
//  Commands:
//    /willow /fancode /sonyliv /hotstar /jtv /star /sony /zee
//    /willow1 /fancode3 /hotstar10 /jtv5 /star2 /sony1 /zee1
//    /list /help
// ================================================================

const PLAYLISTS = {
  willow:  "https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.m3u",
  fancode: "https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u",
  sonyliv: "https://raw.githubusercontent.com/drmlive/sliv-live-events/refs/heads/main/sonyliv.m3u",
  hotstar: "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/hotstar.m3u",
  jtv:     "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/jtvplus7.m3u",
  star:    "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/Star.m3u",
  sony:    "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/sony5.m3u",
  zee:     "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/zee.m3u"
};

// Per-source defaults for Referer / Origin
const HEADER_DEFAULTS = {
  willow:  { referer: '', origin: '' },
  fancode: { referer: '', origin: '' },
  sonyliv: { referer: 'https://www.sonyliv.com/',  origin: 'https://www.sonyliv.com' },
  hotstar: { referer: 'https://www.hotstar.com/',  origin: 'https://www.hotstar.com' },
  jtv:     { referer: '', origin: '' },
  star:    { referer: '', origin: '' },
  sony:    { referer: 'https://www.sonyliv.com/',  origin: 'https://www.sonyliv.com' },
  zee:     { referer: '', origin: '' }
};

// 5-minute cache
let cache = { data: null, expiry: 0 };

// ---------- Extract cookie from EXTHTTP JSON (case-insensitive) ----------
function extractCookieFromJson(str) {
  try {
    const json = JSON.parse(str);
    for (const k of Object.keys(json)) {
      if (k.toLowerCase() === 'cookie' && json[k]) return json[k];
    }
  } catch (e) {}
  const m = str.match(/["']cookie["']\s*:\s*["']([^"']+)["']/i);
  return m ? m[1] : '';
}

// ---------- Parse M3U ----------
function parseM3U(content) {
  const lines = content.split('\n');
  const streams = [];
  let current = null;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const nameMatch  = line.match(/tvg-name="([^"]*)"/);
      const idMatch    = line.match(/tvg-id="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const logoMatch  = line.match(/tvg-logo="([^"]*)"/);
      let fallbackName = 'Unknown';
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        fallbackName = line.substring(commaIdx + 1).trim() || 'Unknown';
      }

      current = {
        id:      idMatch    ? idMatch[1]    : '',
        name:    nameMatch  ? nameMatch[1]  : fallbackName,
        group:   groupMatch ? groupMatch[1] : '',
        logo:    logoMatch  ? logoMatch[1]  : '',
        url:     '',
        drm:     '',
        cookie:  '',
        referer: '',
        origin:  ''
      };
    }
    else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=') && current) {
      const v = line.substring('#KODIPROP:inputstream.adaptive.license_key='.length).trim();
      if (v && v !== 'null:null' && v !== ':') current.drm = v;
    }
    else if (line.startsWith('#EXTVLCOPT:http-cookie=') && current) {
      current.cookie = line.substring('#EXTVLCOPT:http-cookie='.length).trim();
    }
    else if (line.startsWith('#EXTHTTP:') && current) {
      const payload = line.substring('#EXTHTTP:'.length).trim();
      const ck = extractCookieFromJson(payload);
      if (ck) current.cookie = ck;
      try {
        const json = JSON.parse(payload);
        for (const k of Object.keys(json)) {
          const lk = k.toLowerCase();
          if (lk === 'referer' || lk === 'referrer') {
            if (json[k]) current.referer = json[k];
          }
          if (lk === 'origin' && json[k]) current.origin = json[k];
        }
      } catch (e) {}
    }
    else if (line.startsWith('#EXTVLCOPT:http-referrer=') && current) {
      current.referer = line.substring('#EXTVLCOPT:http-referrer='.length).trim();
    }
    else if (line.startsWith('#EXTVLCOPT:http-extra-headers=Origin:') && current) {
      current.origin = line.split('Origin:')[1]?.trim() || '';
    }
    // Catch-all for any #header=...# patterns not caught above
    else if (line.startsWith('#EXTVLCOPT:') && current) {
      const rest = line.substring('#EXTVLCOPT:'.length);
      const eq   = rest.indexOf('=');
      if (eq > -1) {
        const key = rest.substring(0, eq).toLowerCase();
        const val = rest.substring(eq + 1).trim();
        if (key.includes('cookie')  && !current.cookie)  current.cookie  = val;
        if (key.includes('refer')   && !current.referer) current.referer = val;
        if (key.includes('origin')  && !current.origin)  current.origin  = val;
      }
    }
    else if (!line.startsWith('#') && current) {
      current.url = line;
      streams.push(current);
      current = null;
    }
  }
  return streams;
}

// ---------- Fetch + cache playlists ----------
async function getStreams() {
  const now = Date.now();
  if (cache.data && cache.expiry > now) return cache.data;

  const all = {};
  await Promise.all(
    Object.entries(PLAYLISTS).map(async ([key, url]) => {
      try {
        const res = await fetch(url, { cf: { cacheTtl: 60 } });
        if (!res.ok) { all[key] = []; return; }
        const text = await res.text();
        all[key] = parseM3U(text);
      } catch (e) {
        all[key] = [];
      }
    })
  );
  cache.data   = all;
  cache.expiry = now + 5 * 60 * 1000;
  return all;
}

// ---------- Telegram API helper ----------
async function tg(method, payload, env) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return r.json();
}

function shortLabel(name, max = 55) {
  if (!name) return 'Unknown';
  if (name.length <= max) return name;
  return name.substring(0, max - 1) + '…';
}

function buildKeyboard(playlistKey, list) {
  return list.map((s, i) => ([{
    text: `${i + 1}. ${shortLabel(s.name)}`,
    callback_data: `s:${playlistKey}:${i}`
  }]));
}

function escapeMd(s) {
  return String(s).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// ---------- Build final stream URL — UNIFIED FOR ALL SOURCES ----------
//   <url>|Cookie=<c>&Referer=<r>&Origin=<o>[&drmScheme=clearkey&drmLicense=<d>]
function buildFinalUrl(playlistKey, s) {
  const url = s.url;
  const def = HEADER_DEFAULTS[playlistKey] || { referer: '', origin: '' };
  const parts = [];

  if (s.cookie) parts.push(`Cookie=${s.cookie}`);

  const referer = s.referer || def.referer;
  if (referer) parts.push(`Referer=${referer}`);

  const origin = s.origin || def.origin;
  if (origin) parts.push(`Origin=${origin}`);

  if (s.drm) {
    parts.push(`drmScheme=clearkey`);
    parts.push(`drmLicense=${s.drm}`);
  }

  return parts.length ? `${url}|${parts.join('&')}` : url;
}

// ---------- Build message text ----------
function streamMessage(playlistKey, s) {
  const finalUrl = buildFinalUrl(playlistKey, s);
  let msg = `📺 *${escapeMd(s.name)}*\n`;
  if (s.group) msg += `🏷 ${escapeMd(s.group)}\n`;
  msg += `\n\`${finalUrl}\``;
  return msg;
}

// ================================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // -------- Debug endpoint --------
    if (url.pathname.startsWith('/debug/')) {
      const [, , key, idxStr] = url.pathname.split('/');
      const idx = parseInt(idxStr) - 1;
      const streams = await getStreams();
      const list = streams[key] || [];
      const s = list[idx];
      if (!s) return new Response(`No entry /${key}/${idxStr}`, { status: 404 });
      return new Response(JSON.stringify({
        playlist:      key,
        index:         idx + 1,
        name:          s.name,
        group:         s.group,
        url:           s.url,
        cookieLen:     s.cookie ? s.cookie.length : 0,
        cookiePreview: s.cookie ? s.cookie.substring(0, 120) + '...' : '(empty)',
        drm:           s.drm || '(none)',
        referer:       s.referer || HEADER_DEFAULTS[key]?.referer || '',
        origin:        s.origin  || HEADER_DEFAULTS[key]?.origin  || '',
        finalUrl:      buildFinalUrl(key, s)
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    // -------- Register webhook --------
    if (url.pathname === '/registerWebhook') {
      const result = await tg('setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.BOT_SECRET,
        allowed_updates: ['message', 'callback_query']
      }, env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // -------- Webhook --------
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secret !== env.BOT_SECRET) return new Response('Unauthorized', { status: 401 });

      const update = await request.json();

      // ===== BUTTON TAP =====
      if (update.callback_query) {
        const cq     = update.callback_query;
        const chatId = cq.message.chat.id;
        const m      = (cq.data || '').match(/^s:([a-z]+):(\d+)$/);

        if (m) {
          const playlistKey = m[1];
          const index       = parseInt(m[2]);
          const streams     = await getStreams();
          const list        = streams[playlistKey] || [];
          const stream      = list[index];

          if (stream) {
            await tg('answerCallbackQuery', {
              callback_query_id: cq.id,
              text: 'Link sent below!'
            }, env);

            await tg('sendMessage', {
              chat_id: chatId,
              text: streamMessage(playlistKey, stream),
              parse_mode: 'Markdown',
              disable_web_page_preview: true
            }, env);
          } else {
            await tg('answerCallbackQuery', {
              callback_query_id: cq.id,
              text: 'Stream not found'
            }, env);
          }
        }
        return new Response('OK');
      }

      // ===== TEXT MESSAGE =====
      if (!update.message) return new Response('OK');

      const chatId  = update.message.chat.id;
      const text    = update.message.text || '';
      const command = text.split(' ')[0].substring(1).toLowerCase();

      // ---- /start & /help ----
      if (command === 'start' || command === 'help') {
        const streams = await getStreams();
        let msg = '👋 *Sports Bot — All Playlists*\n\n';
        msg += '*Event Playlists:*\n';
        msg += `• /willow — ${streams.willow.length} matches\n`;
        msg += `• /fancode — ${streams.fancode.length} matches\n`;
        msg += `• /sonyliv — ${streams.sonyliv.length} matches\n\n`;
        msg += '*Channel Playlists:*\n';
        msg += `• /hotstar — ${streams.hotstar.length} channels\n`;
        msg += `• /jtv — ${streams.jtv.length} channels\n`;
        msg += `• /star — ${streams.star.length} channels\n`;
        msg += `• /sony — ${streams.sony.length} channels\n`;
        msg += `• /zee — ${streams.zee.length} channels\n\n`;
        msg += 'Direct access: `/willow1`, `/hotstar10`, `/jtv5`, `/zee3`, etc.\n';
        msg += 'Use /list for the full list.';

        await tg('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        }, env);
        return new Response('OK');
      }

      // ---- /list ----
      if (command === 'list') {
        const streams = await getStreams();
        let msg = '📋 *All Commands*\n\n';
        for (const [key, list] of Object.entries(streams)) {
          msg += `*${key.toUpperCase()}* (${list.length})\n`;
          list.forEach((s, i) => {
            msg += `  \`/${key}${i + 1}\` — ${escapeMd(shortLabel(s.name, 45))}\n`;
          });
          msg += '\n';
        }
        await tg('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        }, env);
        return new Response('OK');
      }

      // ---- /willow, /fancode, /hotstar, /zee, etc. → buttons ----
      if (PLAYLISTS[command]) {
        const streams = await getStreams();
        const list    = streams[command] || [];

        if (!list.length) {
          await tg('sendMessage', {
            chat_id: chatId,
            text: `⚠️ No items available in /${command} right now.`
          }, env);
          return new Response('OK');
        }

        const keyboard = buildKeyboard(command, list);
        await tg('sendMessage', {
          chat_id: chatId,
          text: `📺 *${command.toUpperCase()}* — ${list.length} item${list.length > 1 ? 's' : ''}\n\nTap an item to get the link:`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }, env);
        return new Response('OK');
      }

      // ---- /willow1, /hotstar10, /zee3, etc. ----
      const m = command.match(/^([a-z]+)(\d+)$/);
      if (m && PLAYLISTS[m[1]]) {
        const playlistKey = m[1];
        const index       = parseInt(m[2]) - 1;
        const streams     = await getStreams();
        const list        = streams[playlistKey] || [];

        if (list[index]) {
          await tg('sendMessage', {
            chat_id: chatId,
            text: streamMessage(playlistKey, list[index]),
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }, env);
        } else {
          await tg('sendMessage', {
            chat_id: chatId,
            text: `❌ Item #${index + 1} not found in /${playlistKey}.\nUse /${playlistKey} to see available items.`
          }, env);
        }
        return new Response('OK');
      }

      // ---- Unknown ----
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ Unknown command: /${command}\nTry /willow, /fancode, /sonyliv, /hotstar, /jtv, /star, /sony, /zee, or /help.`
      }, env);

      return new Response('OK');
    }

    return new Response('Bot running.', { status: 200 });
  }
};
