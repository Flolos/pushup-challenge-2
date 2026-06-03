const { kv } = require('@vercel/kv');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const data = await kv.get('pushup_db') || {};
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { user, date, sets } = req.body;
    if (!user || !date || !sets) return res.status(400).json({ error: 'Missing fields' });
    const data = await kv.get('pushup_db') || {};
    if (!data[user]) data[user] = {};
    data[user][date] = sets;
    await kv.set('pushup_db', data);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
