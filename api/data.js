export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  async function kvGet(key) {
    const r = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const j = await r.json();
    if (!j.result) return null;
    try {
      return typeof j.result === 'string' ? JSON.parse(j.result) : j.result;
    } catch {
      return null;
    }
  }

  async function kvSet(key, value) {
    const encoded = encodeURIComponent(JSON.stringify(value));
    await fetch(`${url}/set/${key}/${encoded}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  if (req.method === 'GET') {
    const data = await kvGet('pushup_db') || {};
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { user, date, sets } = req.body;
    if (!user || !date || !sets) return res.status(400).json({ error: 'Missing fields' });
    const data = await kvGet('pushup_db') || {};
    if (!data[user]) data[user] = {};
    data[user][date] = sets;
    await kvSet('pushup_db', data);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
