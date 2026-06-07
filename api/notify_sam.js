export default async function handler(req, res) {
  const time = req.query.time;

  const baseUrl = `https://${req.headers.host}`;
  const dataRes = await fetch(`${baseUrl}/api/data`);
  const allData = await dataRes.json();

  const GOAL = 100;
  const CHALLENGE_START = new Date('2026-06-08');
  const elapsed = Math.max(0, Math.floor((new Date() - CHALLENGE_START) / 864e5));

  const stats = {};
  for (const uid of ['flo', 'max', 'andy', 'sandro']) {
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

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      system: buildSystemPrompt(time),
      messages: [{ role: 'user', content: buildUserPrompt(time, stats, elapsed) }]
    })
  });

  const claudeData = await claudeRes.json();
  if (!claudeData.content || !claudeData.content[0]) {
    console.error('Claude error:', JSON.stringify(claudeData));
    return res.status(500).json({ ok: false, error: 'Claude API failed', details: claudeData });
  }
  const message = claudeData.content[0].text;

  const botRes = await fetch('https://pushup-challenge-production-3609.up.railway.app/send-group', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'push365'
    },
    body: JSON.stringify({
      group: 'SAM(en)',
      message: message
    })
  });

  const botData = await botRes.json();
  if (!botData.ok && !botData.success) {
    console.error('Bot error:', JSON.stringify(botData));
    return res.status(500).json({ ok: false, error: 'Bot failed', details: botData });
  }

  return res.status(200).json({ ok: true, message });
}

function buildSystemPrompt(time) {
  return `Du bist Military Drill-Sergeant, der vier Männer durch eine 365-Tage Liegestütz-Challenge coacht. Du schreibst WhatsApp-Nachrichten in die Gruppe "SAM(en)".

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
- Sportlich aber nie konsequent — Bouldern, Thaiboxen
- Schlank, athletisch, hätte gerne mehr Kampfgewicht
- Keine Haare mehr
- Sohn 2 Jahre, Frau Anne
- Wäre gerne kräftiger

MAX (München, Mitte 40):
- Junggeselle, Hank Moody Style — Lifestyle, Frauen, Münchner Partyleben
- Chiceria, sehr belesen in deutscher Literatur, Sprachwissenschaftler
- Sehr sportlich und athletisch, geht Klettern mit seinen drei Brüdern
- Arbeitet im Sales, aktuell kein Job — viel Zeit und Freizeitstress
- Hat immer wieder ein neues Mädel am Start
- Fake Rolex Uhren zu Hause
- Sehr lieber Typ

ANDY (München, Mitte 40):
- Freundin Katharina, Tochter ca. 12 Jahre
- Kommunikations-Coach, spezialisiert auf Gewaltfreie Kommunikation
- Macht Ecstatic Dance, Tantra Retreats, ist in Männer-Circeln unterwegs
- Viel Selbstfindung, etwas spirituell
- Zerdenkt Themen, verharrt, tut sich schwer mit Aktionismus
- Beschäftigt sich stark mit der Rolle der Männlichkeit
- Fängt gerade wieder mit Sport an, macht bereits eine Burpee-Challenge

SANDRO (Portugal):
- Erfolgreicher Personalberater/Headhunter im Public Sector und Tier-1-Beratungen
- Frau Maine (Brasilianerin), 2 kleine Kinder
- Lebt in Portugal, Ende 30
- Früher großer Kämpfer mit Struktur — hat es früher nicht mal geschafft eine Mail zu lesen
- Vermutlich ADHS
- War erfolgreicher Karate-Kampfsportler
- Sehr großes Ego, muss oft auf den Boden zurückgeholt werden
- Sehr begeisterungsfähig, verliert aber schnell das Interesse
- Nebenbei Psychedelic Integration Coach und intensiver Ayahuasca-Jünger

BEZIEHUNG: Flo, Max, Andy und Sandro sind sehr gute Freunde.

${time === 'midday'
    ? 'MITTAGS (12 Uhr): Neutral-motivierend. Perspektive ähnlich eines Vaters oder guten Freundes. Auf aktuelle Stats eingehen. Animiere alle. Keine zu harten Seitenhiebe mittags.'
    : 'ABENDS (20 Uhr): Sarkastisch-ironisch. Fokus auf die, die noch nichts oder wenig gemacht haben. Leichte Tiefschläge erlaubt — zum Beispiel Andy wenn er wieder nicht in die Gänge kommt, Sandro wenn sein Ego größer ist als seine Liegestütz-Zahl, Max wenn er gerade wieder mit einem neuen Mädel beschäftigt war. Trotzdem motivierend am Ende.'
  }`;
}

function buildUserPrompt(time, stats, elapsed) {
  const names = { flo: 'Flo', max: 'Max', andy: 'Andy', sandro: 'Sandro' };
  const sorted = Object.entries(stats).sort((a, b) => {
    if (b[1].goalDays !== a[1].goalDays) return b[1].goalDays - a[1].goalDays;
    return b[1].total - a[1].total;
  });
  const statsText = sorted.map(([uid, s]) =>
    `${names[uid]}: ${s.todayTotal} Liegestütze heute | ${s.goalDays} Tage Ziel erreicht | ${s.total} gesamt`
  ).join('\n');
  const berlinTime = new Date().toLocaleTimeString('de-DE', {timeZone:'Europe/Berlin', hour:'2-digit', minute:'2-digit'});
  return `Tag ${elapsed + 1} der Challenge. Aktuelle Uhrzeit in Berlin: ${berlinTime}.\n\n${statsText}\n\nSchreibe jetzt die ${time === 'midday' ? 'Mittags' : 'Abend'}-Nachricht für die Gruppe.`;
}
