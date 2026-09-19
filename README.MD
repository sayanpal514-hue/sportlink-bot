# 📺 Sportlink Bot — Telegram Streaming Bot

A Telegram bot that serves live sports streams from M3U playlists — deployed on **Cloudflare Workers**

Users type a simple command like `/willow` or `/fancode`, and the bot replies with all available matches as tappable buttons. Tapping a button sends the stream URL + DRM keys.

---

## ⚠️ Disclaimer

> **This project is made strictly for educational and research purposes only.**
>
> - This bot **does not host, store, or stream** any content.
> - It only **parses publicly available M3U playlists** and forwards links to the user.
> - All streams, trademarks, logos, and content belong to their **respective owners**.
> - The author(s) of this project **do not endorse or encourage** piracy or copyright infringement in any form.
> - Users are solely responsible for how they use this software and any links they access.
> - If you are a copyright holder and believe your content has been referenced, please contact the source of the M3U playlist directly.
> - Use of this bot must comply with your local laws and the terms of service of the platforms involved.
>
> By using this project, you accept full responsibility for your actions.

---

## ✨ Features

- 🎯 **Multiple playlists** — Willow, Fancode, SonyLIV, Hotstar, JTV, Star, Sony, Zee — and easily extendable
- 🔘 **Inline buttons** — every match is a tappable button, no typing IDs
- 🔐 **DRM-aware** — extracts and sends ClearKey license keys automatically
- ⚡ **Fast** — 5-minute cache, no repeated GitHub calls
- 🌍 **Serverless** — runs on Cloudflare Workers, 100% free
- 🔗 **Direct commands** — `/willow1`, `/fancode3`, etc. for quick access
- 📱 **Works in groups & DMs**

---

## 🤖 Try the bot

👉 **[@magnet10_bot](https://t.me/magnet10_bot)**

---

## 📋 Available Commands

### 🔹 General

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + list of available playlists |
| `/help` | Same as `/start` |
| `/list` | Full list of every match command |

---

### 📺 Platform Menus (Inline Buttons)

| Command | Description |
|---------|-------------|
| `/willow` | All Willow matches as buttons |
| `/fancode` | All Fancode matches as buttons |
| `/sonyliv` | All SonyLIV matches as buttons |
| `/hotstar` | All Hotstar matches as buttons |
| `/jtv` | All JTV matches as buttons |
| `/star` | All Star matches as buttons |
| `/sony` | All Sony matches as buttons |
| `/zee` | All Zee matches as buttons |

---


---

## 🌐 Deployment

This bot runs entirely on **Cloudflare Workers** — no server needed.

```
wrangler deploy
```

Set your bot token as a Worker secret:@BotFather  from this 

```
wrangler secret put TELEGRAM_BOT_TOKEN
```

---

## 📡 Supported Platforms

| Platform | Menu Command | Direct Command |
|----------|-------------|----------------|
| Willow   | `/willow`   | `/willow1`     |
| Fancode  | `/fancode`  | `/fancode3`    |
| SonyLIV  | `/sonyliv`  | `/sonyliv1`    |
| Hotstar  | `/hotstar`  | `/hotstar`     |
| JTV      | `/jtv`      | `/jtv`         |
| Star     | `/star`     | `/star`        |
| Sony     | `/sony`     | `/sony1`       |
| Zee      | `/zee`      | `/zee`         |

---

> **Note:** Stream availability depends on match schedule and broadcasting rights.
