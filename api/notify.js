export default async function handler(req, res) {
  const time = req.query.time; // 'midday' or 'evening'

  // 1. Stats holen
  const baseUrl = `https://${req.headers.host}`;
  const dataRes = await fetch(`${baseUrl}/api/data`);
  const allData = await dataRes.json();

  const GOAL = 100;
  const CHALLENGE_START = new Date('2026-06-04');
  const elapsed = Math.max(0, Math.floor((new Date() - CHALLENGE_START) / 864e5));

  const stats = {};
  for (const uid of ['flo', 'patrick', 'dominik']) {
    const udata = allData[uid] || {};
    let total = 0, goalDays = 0, todayTotal = 0;
    const today = new Date().toLocaleDateString('sv-SE', {timeZone: 'Europe/Berlin'});

    for (let i = 0; i <= elapsed; i++) {
      const d = new Date(CHALLENGE_START);
      d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString('sv-SE', {timeZone: 'Europe/Berlin'});
      const sets = udata[key] || [];
      const dayTotal = sets.reduce((a, s) => a + s.reps, 0);
      total += dayTotal;
      if (dayTotal >= GOAL) goalDays++;
      if (key === today) todayTotal = dayTotal;
    }
    stats[uid] = { total, goalDays, todayTotal };
  }

  // 2. Claude Nachricht generieren
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: buildSystemPrompt(time),
      messages: [{ role: 'user', content: buildUserPrompt(time, stats, elapsed) }]
    })
  });

  const claudeData = await claudeRes.json();
  const message = claudeData.content[0].text;

  // 3. WhatsApp senden via Meta Cloud API direkt
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID; // 969492749221290
  const accessToken = process.env.META_ACCESS_TOKEN;
  const groupId = process.env.WHATSAPP_GROUP_ID; // z.B. 120363xxxxxx@g.us

  const metaRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: groupId,
        type: 'template',
        template: {
          name: 'daily_motivation',
          language: { code: 'de' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: message }
              ]
            }
          ]
        }
      })
    }
  );

  const metaData = await metaRes.json();

  if (metaData.error) {
    console.error('Meta API error:', metaData.error);
    return res.status(500).json({ ok: false, error: metaData.error.message });
  }

  return res.status(200).json({ ok: true, message, metaId: metaData.messages?.[0]?.id });
}

function buildSystemPrompt(time) {
  return `Du bist Military Drill-Sergeant, der jetzt drei Männer durch eine 365-Tage Liegestütz-Challenge coacht. Du schreibst WhatsApp-Nachrichten in die Gruppe der drei.

DEIN STIL:
- Humor-Mix aus Jimmy Carr (dunkel, sarkastisch, präzise Tiefschläge) und Jimmy Fallon (warm, selbstironisch, manchmal albern)
- Immer direkt mit Namen ansprechen
- Militärische Sprache gemischt mit modernem Slang
- Nie länger als 5-6 Sätze
- Keine Emojis außer maximal 1 pro Nachricht
- Unterschreibe immer mit " — DEIN SCHLECHTES GEWISSEN"

INFOS ZU DEN TEILNEHMERN:

FLO (Berlin, 39):
- Freelancer, letztes Jahr arbeitslos
- Sportlich aber nie konsequent — Bouldern mit Patrick, Thaiboxen
- Schlank, athletisch, hätte gerne mehr Kampfgewicht
- Keine Haare mehr
- Sohn 2 Jahre, Frau Anne (zierlich, sehr lieb, tolle Mama)
- Kann kaum Klimmzüge, geht selten ins Gym
- Wäre gerne kräftiger

PATRICK (Berlin, Surfer-Look, Pferdeschwanz):
- Freelancer, aktuell wenige Aufträge
- Massiver Oberkörper, dünne Beine
- Bouldern mit Flo — Wettbewerbsdenken zwischen beiden
- Yoga, Padel, Snowboard, Skitouren
- Lebt mehrere Monate/Jahr in Portugal mit Familie, surft
- Kommt aus dem Allgäu, war aber nie richtig in den Bergen
- Bruder ist echte Bergziege
- Frau Çiler macht Reformer Pilates, sehr gut
- Sohn 1 Jahr

DOMINIK (München):
- Gründet aktuell sein DRITTES Unternehmen parallel
- Absoluter Workaholic, kaum noch Zeit für Sport
- Letztes Jahr sehr wenig Sport
- Verheiratet, 2 Kinder (2 und 4 Jahre)
- Frau heißt Sarah, super tough, athletisch, mental stark
- Stark im autistischen Spektrum ausgeprägt, sagt immer exakt was er denkt

BEZIEHUNG: Patrick, Dominik und Flo sind beste Freunde.

${time === 'midday'
    ? 'MITTAGS (12 Uhr): Neutral-motivierend. Perspektive ähnlich eines Vaters oder guten Freundes. Auf aktuelle Stats eingehen. Nur bei wirklich starker Leistung jemanden herausheben — nicht jedes Mal. Animiere alle.'
    : 'ABENDS (20 Uhr): Sarkastisch-ironisch. Fokus auf die, die noch nichts oder wenig gemacht haben. Leichte Tiefschläge erlaubt. Trotzdem motivierend am Ende. Dunkler Humor ist erwünscht.'
  }`;
}

function buildUserPrompt(time, stats, elapsed) {
  const names = { flo: 'Flo', patrick: 'Patrick', dominik: 'Dominik' };
  const sorted = Object.entries(stats).sort((a, b) => {
    if (b[1].goalDays !== a[1].goalDays) return b[1].goalDays - a[1].goalDays;
    return b[1].total - a[1].total;
  });

  const statsText = sorted.map(([uid, s]) =>
    `${names[uid]}: ${s.todayTotal} Liegestütze heute | ${s.goalDays} Tage Ziel erreicht | ${s.total} gesamt`
  ).join('\n');

  return `Tag ${elapsed + 1} der Challenge. Aktuelle Stats:\n\n${statsText}\n\nSchreibe jetzt die ${time === 'midday' ? 'Mittags' : 'Abend'}-Nachricht für die Gruppe.`;
}
