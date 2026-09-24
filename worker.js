// ================================================================
//  Sportlink-Bot — All Playlists, unified pipe output
//    <url>|Cookie=<c>&Referer=<r>&Origin=<o>[&drmScheme=clearkey&drmLicense=<d>]
//
//  Commands:
//    /willow /fancode /sonyliv /hotstar /jtv /star /sony /zee /zee5
//    /jtv153       → item with tvg-id="153"  (ONLY tvg-id lookup for jtv)
//    /willow5      → 5th item (index based for all other playlists)
//    /list /help
//
//  Bot ONLY responds to:
//    /command
//    /command@magnet10_bot
// ================================================================

const PLAYLISTS = {
  willow:  "https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.m3u",
  fancode: "https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u",
  sonyliv: "https://raw.githubusercontent.com/drmlive/sliv-live-events/refs/heads/main/sonyliv.m3u",
  hotstar: "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/hotstar.m3u",
  jtv:     "https://raw.githubusercontent.com/sportlink10/playlist/refs/heads/main/jtvplus7.m3u",
  star:    "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/Star2.m3u",
  sony:    "https://raw.githubusercontent.com/sportlink10/playlist/refs/heads/main/sony5.m3u",
  zee:     "https://raw.githubusercontent.com/sportlive18/jio-tv-auto-update-playlist/refs/heads/main/zee.m3u",
  zee5:    "https://raw.githubusercontent.com/doctor-8trange/quarnex/refs/heads/main/data/zee5.m3u"
};

const BOT_USERNAME = 'magnet10_bot';

const TVGID_ONLY     = ['jtv'];
const PIPE_PLAYLISTS = ['willow', 'fancode', 'hotstar', 'star', 'jtv', 'sony', 'zee', 'zee5'];

const HEADER_DEFAULTS = {
  willow:  { referer: '', origin: '' },
  fancode: { referer: '', origin: '' },
  sonyliv: { referer: 'https://www.sonyliv.com/',  origin: 'https://www.sonyliv.com' },
  hotstar: { referer: 'https://www.hotstar.com/',  origin: 'https://www.hotstar.com' },
  jtv:     { referer: 'https://www.jiotv.com/',    origin: 'https://www.jiotv.com' },
  star:    { referer: 'https://www.hotstar.com/',  origin: 'https://www.hotstar.com' },
  sony:    { referer: 'https://www.sonyliv.com/',  origin: 'https://www.sonyliv.com' },
  zee:     { referer: '',                          origin: '' },
  zee5:    {
    referer:   'https://www.zee5.com/',
    origin:    'https://www.zee5.com',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0'
  }
};

const CHANNEL_TG = 'https://t.me/sportlink10';
const CHANNEL_WA = 'https://whatsapp.com/channel/0029VbC2oQsC6ZvmwpR3v73v';
const WEB_BASE   = 'https://sportlink10-ajp.pages.dev';

const CAPTION_LIMIT = 1024;

// ---------- Keyboards ----------
function channelKeyboard(extraRows = []) {
  return [
    ...extraRows,
    [{ text: '📢 Join Telegram Channel', url: CHANNEL_TG }],
    [{ text: '💬 Join WhatsApp Channel', url: CHANNEL_WA }]
  ];
}

function playlistKeyboard(playlistKey, extraRows = []) {
  return [
    [{ text: `🌐 Web Page: /${playlistKey}`, url: `${WEB_BASE}/${playlistKey}` }],
    ...extraRows,
    [{ text: '📢 Join Telegram Channel', url: CHANNEL_TG }],
    [{ text: '💬 Join WhatsApp Channel', url: CHANNEL_WA }]
  ];
}

function streamKeyboard(playlistKey, extraRows = []) {
  return [
    [{ text: `🌐 Web Page: /${playlistKey}`, url: `${WEB_BASE}/${playlistKey}` }],
    ...extraRows,
    [{ text: '📢 Join Telegram Channel', url: CHANNEL_TG }],
    [{ text: '💬 Join WhatsApp Channel', url: CHANNEL_WA }]
  ];
}

let cache = { data: null, expiry: 0 };

// ---------- Cookie from EXTHTTP JSON ----------
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

// ---------- Final PIPE URL ----------
//   <url>[|User-Agent=<ua>][&Cookie=<c>][&Referer=<r>][&Origin=<o>][&drmScheme=clearkey&drmLicense=<d>]
function buildFinalUrl(playlistKey, s) {
  const url = s.url;
  const def = HEADER_DEFAULTS[playlistKey] || { referer: '', origin: '' };
  const parts = [];

  // User-Agent (only if defined for this playlist — currently only zee5)
  if (def.userAgent) parts.push(`User-Agent=${def.userAgent}`);

  // Cookie (only if a separate cookie value exists — zee5 keeps it in the URL)
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

function finalLink(playlistKey, s) {
  return PIPE_PLAYLISTS.includes(playlistKey) ? buildFinalUrl(playlistKey, s) : s.url;
}

// ---------- Backtick code wrapper ----------
function asCode(link) {
  const clean = String(link).replace(/`/g, '');
  return '`' + clean + '`';
}

// ================================================================
//  Cookie expiry (IST) — parses `exp=<unix>` from cookie OR from URL
// ================================================================
function getCookieExpiryIST(cookie, url) {
  const src = cookie || url || '';
  const m = src.match(/\bexp=(\d{9,11})/i);
  if (!m) return '';
  const expUnix = parseInt(m[1], 10);
  if (!expUnix || isNaN(expUnix)) return '';

  const IST_OFFSET_MIN = 5 * 60 + 30;
  const istMs = (expUnix + IST_OFFSET_MIN * 60) * 1000;
  const d = new Date(istMs);

  const pad = n => String(n).padStart(2, '0');
  const Y  = d.getUTCFullYear();
  const M  = pad(d.getUTCMonth() + 1);
  const D  = pad(d.getUTCDate());
  const h  = pad(d.getUTCHours());
  const m2 = pad(d.getUTCMinutes());
  const s2 = pad(d.getUTCSeconds());

  return `${Y}-${M}-${D} ${h}:${m2}:${s2} IST`;
}

// ---------- Short photo caption ----------
function photoCaptionShort(num, s) {
  return `${num}) ${s.name}`;
}

// ---------- Markdown caption for photo (copyable link + expiry) ----------
function markdownCaption(playlistKey, num, s) {
  const link = finalLink(playlistKey, s);
  let t = `*${num}\\)* ${escapeMd(s.name)}\n`;
  if (s.id)    t += `🆔 ${escapeMd(s.id)}\n`;
  if (s.group) t += `🏷 ${escapeMd(s.group)}\n`;
  t += `\n${asCode(link)}`;

  const exp = getCookieExpiryIST(s.cookie, s.url);
  if (exp) t += `\n\n⏳ Cookie expires: ${exp}`;
  return t;
}

// ---------- Plain fallback caption ----------
function plainCaption(playlistKey, num, s) {
  const link = finalLink(playlistKey, s);
  let t = `${num}) ${s.name}`;
  if (s.id) t += `\n🆔 ${s.id}`;
  if (s.group) t += `\n🏷 ${s.group}`;
  t += `\n\n${link}`;

  const exp = getCookieExpiryIST(s.cookie, s.url);
  if (exp) t += `\n\n⏳ Cookie expires: ${exp}`;
  return t;
}

// ---------- Markdown message for no-logo fallback ----------
function streamMessage(playlistKey, s) {
  const link = finalLink(playlistKey, s);
  let msg = `📺 *${escapeMd(s.name)}*\n`;
  if (s.id)    msg += `🆔 ${escapeMd(s.id)}\n`;
  if (s.group) msg += `🏷 ${escapeMd(s.group)}\n`;
  msg += `\n${asCode(link)}`;

  const exp = getCookieExpiryIST(s.cookie, s.url);
  if (exp) msg += `\n\n⏳ Cookie expires: ${exp}`;
  return msg;
}

// ---------- Send ONE stream ----------
async function sendStream(chatId, playlistKey, s, env, extraKeyboard = []) {
  const keyboard = streamKeyboard(playlistKey, extraKeyboard);

  const mdCaption     = markdownCaption(playlistKey, 1, s);
  const plainCaptionV = plainCaption(playlistKey, 1, s);

  if (s.logo && /^https?:\/\//i.test(s.logo)) {
    // 1) Markdown caption
    if (mdCaption.length <= CAPTION_LIMIT) {
      try {
        const r = await tg('sendPhoto', {
          chat_id: chatId,
          photo: s.logo,
          caption: mdCaption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }, env);
        if (r && r.ok) return;
        console.log('sendPhoto markdown failed:', JSON.stringify(r));
      } catch (e) {
        console.log('sendPhoto exception:', e.message);
      }
    }

    // 2) Plain-text caption
    if (plainCaptionV.length <= CAPTION_LIMIT) {
      try {
        const r = await tg('sendPhoto', {
          chat_id: chatId,
          photo: s.logo,
          caption: plainCaptionV,
          reply_markup: { inline_keyboard: keyboard }
        }, env);
        if (r && r.ok) return;
      } catch (e) {}
    }

    // 3) Short caption + reply
    try {
      const r = await tg('sendPhoto', {
        chat_id: chatId,
        photo: s.logo,
        caption: photoCaptionShort(1, s),
        reply_markup: { inline_keyboard: keyboard }
      }, env);
      if (r && r.ok && r.result && r.result.message_id) {
        await tg('sendMessage', {
          chat_id: chatId,
          text: streamMessage(playlistKey, s),
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_to_message_id: r.result.message_id,
          reply_markup: { inline_keyboard: streamKeyboard(playlistKey) }
        }, env);
        return;
      }
    } catch (e) {}
  }

  // 4) No logo → text
  await tg('sendMessage', {
    chat_id: chatId,
    text: streamMessage(playlistKey, s),
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard }
  }, env);
}

// ================================================================
function extractCommand(rawText) {
  if (!rawText) return null;
  const t = rawText.trim();
  if (!t.startsWith('/')) return null;

  const firstWord = t.split(/\s+/)[0];
  const body      = firstWord.substring(1);

  const atIdx = body.indexOf('@');
  const cmd   = atIdx === -1 ? body : body.substring(0, atIdx);
  const user  = atIdx === -1 ? null : body.substring(atIdx + 1);

  if (!cmd) return null;
  if (user && user.toLowerCase() !== BOT_USERNAME.toLowerCase()) return null;

  return cmd.toLowerCase();
}

// ================================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // -------- Debug endpoint --------
    if (url.pathname.startsWith('/debug/')) {
      const [, , key, idxStr] = url.pathname.split('/');
      const streams = await getStreams();
      const list = streams[key] || [];

      let s;
      if (TVGID_ONLY.includes(key)) {
        s = list.find(x => x.id && String(x.id) === idxStr);
      } else {
        s = list[parseInt(idxStr) - 1];
      }

      if (!s) return new Response(`No entry /${key}/${idxStr}`, { status: 404 });

      const finalUrl  = finalLink(key, s);
      const mdCaption = markdownCaption(key, 1, s);

      return new Response(JSON.stringify({
        playlist:      key,
        tvgId:         s.id,
        name:          s.name,
        group:         s.group,
        logo:          s.logo || '(none)',
        url:           s.url,
        cookieLen:     s.cookie ? s.cookie.length : 0,
        cookiePreview: s.cookie ? s.cookie.substring(0, 120) + '...' : '(empty)',
        cookieExpires: getCookieExpiryIST(s.cookie, s.url) || '(not found)',
        drm:           s.drm || '(none)',
        referer:       s.referer || HEADER_DEFAULTS[key]?.referer || '',
        origin:        s.origin  || HEADER_DEFAULTS[key]?.origin  || '',
        finalUrl,
        captionLen:    mdCaption.length,
        fitsInCaption: mdCaption.length <= CAPTION_LIMIT
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
        const m      = (cq.data || '').match(/^s:([a-z0-9]+):(\d+)$/);

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

            await sendStream(chatId, playlistKey, stream, env);
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
      if (!update.message.text) return new Response('OK');

      const command = extractCommand(update.message.text);
      if (!command) return new Response('OK');

      const chatId = update.message.chat.id;

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
        msg += `• /zee — ${streams.zee.length} channels\n`;
        msg += `• /zee5 — ${streams.zee5.length} channels\n\n`;
        msg += '*Direct access:*\n';
        msg += '• `/jtv153` → JioTV channel with **tvg-id=153**\n';
        msg += '• `/willow5` → 5th item in willow playlist\n';
        msg += '• `/zee51` → 1st item in zee5 playlist\n';
        msg += 'Use /list for the full list.';

        await tg('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: channelKeyboard() }
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
            const suffix = TVGID_ONLY.includes(key) && s.id ? s.id : String(i + 1);
            msg += `  \`/${key}${suffix}\` — ${escapeMd(shortLabel(s.name, 45))}\n`;
          });
          msg += '\n';
        }
        await tg('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: channelKeyboard() }
        }, env);
        return new Response('OK');
      }

      // ---- Playlist command → buttons ----
      if (PLAYLISTS[command]) {
        const streams = await getStreams();
        const list    = streams[command] || [];

        if (!list.length) {
          await tg('sendMessage', {
            chat_id: chatId,
            text: `⚠️ No items available in /${command} right now.`,
            reply_markup: { inline_keyboard: playlistKeyboard(command) }
          }, env);
          return new Response('OK');
        }

        const itemRows = buildKeyboard(command, list);
        const keyboard = playlistKeyboard(command, itemRows);

        await tg('sendMessage', {
          chat_id: chatId,
          text: `📺 *${command.toUpperCase()}* — ${list.length} item${list.length > 1 ? 's' : ''}\n\nTap an item to get the link:`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }, env);
        return new Response('OK');
      }

      // ---- /willow5, /hotstar10, /jtv153, /zee51, etc. ----
      // Try longest matching playlist key first so /zee51 → zee5 + 1
      let playlistKey = null;
      let numStr      = null;
      for (let split = command.length - 1; split > 0; split--) {
        const k = command.substring(0, split);
        const n = command.substring(split);
        if (/^\d+$/.test(n) && PLAYLISTS[k]) {
          playlistKey = k;
          numStr      = n;
          break;
        }
      }

      if (playlistKey) {
        const num         = parseInt(numStr, 10);
        const streams     = await getStreams();
        const list        = streams[playlistKey] || [];

        let stream      = null;
        let notFoundMsg = '';

        if (TVGID_ONLY.includes(playlistKey)) {
          stream = list.find(s => s.id && String(s.id) === numStr);
          if (!stream) {
            notFoundMsg = `❌ No channel with *tvg-id* \`${numStr}\` in /${playlistKey}.\nUse /${playlistKey} to see available channels.`;
          }
        } else {
          stream = list[num - 1];
          if (!stream) {
            notFoundMsg = `❌ Item #${num} not found in /${playlistKey}.\nUse /${playlistKey} to see available items.`;
          }
        }

        if (stream) {
          await sendStream(chatId, playlistKey, stream, env);
        } else {
          await tg('sendMessage', {
            chat_id: chatId,
            text: notFoundMsg,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: playlistKeyboard(playlistKey) }
          }, env);
        }
        return new Response('OK');
      }

      // ---- Unknown ----
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ Unknown command: /${command}\nTry /willow, /fancode, /sonyliv, /hotstar, /jtv, /star, /sony, /zee, /zee5, or /help.`,
        reply_markup: { inline_keyboard: channelKeyboard() }
      }, env);

      return new Response('OK');
    }

    return new Response('Bot running.', { status: 200 });
  }
};
