# 🤖 PUSH365 WhatsApp Bot

WhatsApp-Bot auf Basis von [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), deployed auf [Railway](https://railway.app).

---

## 🚀 Deployment auf Railway

### 1. Repository vorbereiten

```bash
git init
git add .
git commit -m "feat: initial PUSH365 WhatsApp Bot"
```

Push zu GitHub:
```bash
git remote add origin https://github.com/DEIN-USER/push365-whatsapp-bot.git
git push -u origin main
```

### 2. Railway Projekt erstellen

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub Repo**
2. Repository auswählen
3. Railway erkennt das `Dockerfile` automatisch

### 3. Environment Variables setzen

In Railway unter **Variables** folgende Werte eintragen:

| Variable | Wert | Pflicht |
|---|---|---|
| `API_KEY` | Zufälliger Schlüssel (`openssl rand -hex 32`) | ✅ |
| `ADMIN_NUMBERS` | Kommagetrennte Nummern (ohne +) | Optional |
| `BROADCAST_NUMBERS` | Kommagetrennte Nummern (ohne +) | Optional |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` | ✅ |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | ✅ |

`PORT` wird von Railway automatisch gesetzt.

### 4. QR-Code scannen

Nach dem ersten Deploy:

1. Railway Logs öffnen → QR-Code erscheint im Terminal
2. Oder: `GET https://DEINE-URL.railway.app/qr` aufrufen → gibt den QR-String zurück
3. WhatsApp öffnen → **Einstellungen → Verknüpfte Geräte → Gerät hinzufügen** → QR scannen

✅ Bot ist danach dauerhaft verbunden (Session wird gespeichert).

---

## 📡 REST API

### Health Check
```
GET /
```

### QR Code abrufen
```
GET /qr
```

### Nachricht senden
```
POST /send
Header: x-api-key: DEIN_API_KEY
Body: { "to": "+49170123456", "message": "Hallo von PUSH365!" }
```

### Broadcast senden
```
POST /broadcast
Header: x-api-key: DEIN_API_KEY
Body: {
  "numbers": ["+49170123456", "+49171987654"],
  "message": "Wichtige PUSH365 Mitteilung"
}
```

---

## 💬 WhatsApp-Befehle

| Befehl | Funktion |
|---|---|
| `hilfe` | Befehlsübersicht |
| `ping` | Verbindungstest |
| `status` | Uptime & Systemstatus |
| `broadcast [Text]` | Broadcast (nur Admins) |

---

## ⚠️ Wichtige Hinweise

- **Session-Persistenz**: Railway-Volumes für `.wwebjs_auth` nutzen, damit die Session nach Restarts erhalten bleibt (Railway → Add Volume → `/app/.wwebjs_auth`)
- **Rate Limiting**: Zwischen Nachrichten 500ms Pause eingebaut – bei großen Broadcasts ggf. erhöhen
- **WhatsApp ToS**: whatsapp-web.js ist kein offizieller Client – für Business-Nutzung besser [WhatsApp Business API](https://business.whatsapp.com/products/business-platform) prüfen

---

## 🗂️ Projektstruktur

```
push365-whatsapp-bot/
├── index.js          # Bot-Logik & Express-Server
├── package.json
├── Dockerfile
├── railway.toml
├── .env.example      # Vorlage für Environment Variables
└── .gitignore
```
