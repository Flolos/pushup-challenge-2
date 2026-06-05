import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Parse multipart form data manually
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'No boundary' });

    const parts = buffer.toString('binary').split('--' + boundary);
    let imageBuffer = null;
    let filename = 'photo.jpg';
    let uid = 'unknown';
    let date = new Date().toISOString().slice(0, 10);
    let setIndex = '0';

    for (const part of parts) {
      if (part.includes('Content-Disposition')) {
        const nameMatch = part.match(/name="([^"]+)"/);
        const filenameMatch = part.match(/filename="([^"]+)"/);
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const bodyBinary = part.slice(headerEnd + 4, part.endsWith('\r\n') ? -2 : undefined);

        if (nameMatch && nameMatch[1] === 'file' && filenameMatch) {
          filename = filenameMatch[1];
          imageBuffer = Buffer.from(bodyBinary, 'binary');
        } else if (nameMatch && nameMatch[1] === 'uid') {
          uid = bodyBinary.trim();
        } else if (nameMatch && nameMatch[1] === 'date') {
          date = bodyBinary.trim();
        } else if (nameMatch && nameMatch[1] === 'setIndex') {
          setIndex = bodyBinary.trim();
        }
      }
    }

    if (!imageBuffer || imageBuffer.length < 100) {
      return res.status(400).json({ error: 'No image data' });
    }

    const blobPath = `photos/${uid}/${date}/set-${setIndex}-${Date.now()}.jpg`;
    const blob = await put(blobPath, imageBuffer, {
      access: 'public',
      contentType: 'image/jpeg',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return res.status(200).json({ ok: true, url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
}
