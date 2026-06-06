# ── Base Image ────────────────────────────────────────────────────────────────
FROM node:20-slim

# ── Chromium & Dependencies für Puppeteer ─────────────────────────────────────
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer soll system-chromium verwenden
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ── App Setup ─────────────────────────────────────────────────────────────────
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Session-Verzeichnis erstellen
RUN mkdir -p .wwebjs_auth

# ── Ports & Start ─────────────────────────────────────────────────────────────
EXPOSE 3000

CMD ["node", "index.js"]
