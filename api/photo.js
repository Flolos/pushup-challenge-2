import { get } from '@vercel/blob';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL' });

  try {
    const blob = await get(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    if (!blob) return res.status(404).json({ error: 'Not found' });

    const response = await fetch(blob.downloadUrl);
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Photo proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
