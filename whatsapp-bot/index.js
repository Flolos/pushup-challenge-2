const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const fs = require("fs");
const path = require("path");

// ─── Express Health Server (required by Railway) ────────────────────────────
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ─── WhatsApp Client Setup ───────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: process.env.SESSION_PATH || "./.wwebjs_auth",
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--single-process", // Required for Railway
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },
});

// ─── QR Code ─────────────────────────────────────────────────────────────────
let qrCodeData = null;

client.on("qr", (qr) => {
  qrCodeData = qr;
  console.log("📱 QR Code generated – scan with WhatsApp:");
  qrcode.generate(qr, { small: true });
  console.log("\n🔗 Or fetch via: GET /qr (returns raw QR string)");
});

// ─── Ready ────────────────────────────────────────────────────────────────────
client.on("ready", () => {
  qrCodeData = null;
  console.log("✅ PUSH365 WhatsApp Bot is ready!");
  console.log(`📞 Connected as: ${client.info.wid.user}`);
});

// ─── Auth Events ─────────────────────────────────────────────────────────────
client.on("authenticated", () => {
  console.log("🔐 Authenticated successfully");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Auth failure:", msg);
});

client.on("disconnected", (reason) => {
  console.warn("⚠️ Disconnected:", reason);
  // Auto-reconnect after 5s
  setTimeout(() => {
    console.log("🔄 Attempting reconnect...");
    client.initialize();
  }, 5000);
});

// ─── Message Handler ──────────────────────────────────────────────────────────
client.on("message", async (msg) => {
  const body = msg.body.trim();
  const chat = await msg.getChat();
  const contact = await msg.getContact();
  const sender = contact.pushname || contact.number || msg.from;

  console.log(`📨 [${new Date().toISOString()}] ${sender}: ${body}`);

  // ── Command Router ────────────────────────────────────────────────────────
  const lower = body.toLowerCase();

  // Hilfe / Help
  if (lower === "hilfe" || lower === "help" || lower === "/help") {
    await msg.reply(
      `🚀 *PUSH365 Bot* – Verfügbare Befehle:\n\n` +
        `📋 *hilfe* – Diese Übersicht\n` +
        `📊 *status* – Systemstatus\n` +
        `📣 *broadcast [Nachricht]* – Broadcast senden (Admin)\n` +
        `📬 *ping* – Verbindungstest\n\n` +
        `_Bei Fragen wende dich an dein PUSH365-Team._`
    );
    return;
  }

  // Ping
  if (lower === "ping") {
    await msg.reply("🏓 Pong! Bot ist online.");
    return;
  }

  // Status
  if (lower === "status") {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    await msg.reply(
      `📊 *PUSH365 Bot Status*\n\n` +
        `✅ Online\n` +
        `⏱️ Uptime: ${h}h ${m}m ${s}s\n` +
        `📅 ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`
    );
    return;
  }

  // Broadcast (Admin only)
  if (lower.startsWith("broadcast ")) {
    const adminNumbers = (process.env.ADMIN_NUMBERS || "")
      .split(",")
      .map((n) => n.trim());
    const senderNumber = msg.from.replace("@c.us", "");

    if (!adminNumbers.includes(senderNumber)) {
      await msg.reply("⛔ Keine Berechtigung für diesen Befehl.");
      return;
    }

    const broadcastMsg = body.substring(10).trim();
    const recipients = (process.env.BROADCAST_NUMBERS || "")
      .split(",")
      .filter((n) => n.trim());

    if (!recipients.length) {
      await msg.reply(
        "⚠️ Keine Broadcast-Empfänger konfiguriert (BROADCAST_NUMBERS)."
      );
      return;
    }

    let sent = 0;
    for (const number of recipients) {
      try {
        const chatId = number.trim().replace(/\+/g, "") + "@c.us";
        await client.sendMessage(chatId, `📣 *PUSH365 Update:*\n\n${broadcastMsg}`);
        sent++;
        await sleep(500); // Rate limiting
      } catch (e) {
        console.error(`Failed to send to ${number}:`, e.message);
      }
    }

    await msg.reply(`✅ Broadcast gesendet an ${sent}/${recipients.length} Empfänger.`);
    return;
  }

  // Default: Echo für unbekannte Befehle
  // Optional: Entfernen für Silent-Mode
  // await msg.reply(`Unbekannter Befehl. Schreibe *hilfe* für eine Übersicht.`);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// Health check für Railway
app.get("/", (req, res) => {
  res.json({
    service: "PUSH365 WhatsApp Bot",
    status: "running",
    ready: client.info ? true : false,
    timestamp: new Date().toISOString(),
  });
});

// QR Code abrufen (zum Scannen beim ersten Start)
app.get("/qr", (req, res) => {
  if (qrCodeData) {
    res.json({ qr: qrCodeData, hint: "Scan this with WhatsApp > Linked Devices" });
  } else if (client.info) {
    res.json({ status: "already_authenticated", number: client.info.wid.user });
  } else {
    res.status(503).json({ status: "not_ready", message: "QR not yet generated" });
  }
});

app.get("/qr-page", (req, res) => {
  if (!qrCodeData) {
    return res.send(client.info
      ? `<h2>✅ Already authenticated as ${client.info.wid.user}</h2>`
      : `<h2>⏳ QR not ready yet – refresh in a few seconds</h2>`
    );
  }
  res.send(`<!DOCTYPE html><html><head><title>PUSH365 QR</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;padding:40px;background:#111;color:#fff}
  #qrcode{background:white;padding:20px;border-radius:12px;margin:20px 0}</style></head>
  <body><h1>📱 PUSH365 WhatsApp Bot</h1>
  <p>Scan mit WhatsApp → Einstellungen → Verknüpfte Geräte</p>
  <div id="qrcode"></div>
  <script>new QRCode(document.getElementById("qrcode"),{text:${JSON.stringify(qrCodeData)},width:256,height:256});
  setTimeout(()=>location.reload(),15000);</script></body></html>`);
});

// Nachricht senden via API
app.post("/send", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Missing 'to' or 'message'" });
  }

  try {
    const chatId = to.replace(/\+/g, "").replace(/@c\.us$/, "") + "@c.us";
    await client.sendMessage(chatId, message);
    res.json({ success: true, to: chatId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast via API
app.post("/broadcast", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { numbers, message } = req.body;
  if (!numbers || !message || !Array.isArray(numbers)) {
    return res.status(400).json({ error: "Missing 'numbers' (array) or 'message'" });
  }

  const results = [];
  for (const number of numbers) {
    try {
      const chatId = number.replace(/\+/g, "").replace(/@c\.us$/, "") + "@c.us";
      await client.sendMessage(chatId, message);
      results.push({ number, success: true });
      await sleep(500);
    } catch (e) {
      results.push({ number, success: false, error: e.message });
    }
  }

  res.json({ results });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌐 HTTP server listening on port ${PORT}`);
});

console.log("🤖 Starting PUSH365 WhatsApp Bot...");
client.initialize();
