// Vercel serverless function: forwards GraphQL queries to LeetCode.
// The PWA needs this because leetcode.com/graphql doesn't allow browser (CORS) requests.
// Only read-only public queries are forwarded; no cookies or credentials are sent.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  if (body.length > 20_000 || /\bmutation\b/i.test(body)) {
    return res.status(400).json({ error: 'Only small read-only queries are allowed' });
  }

  try {
    const upstream = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0 (LeetPing)',
      },
      body,
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(upstream.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach LeetCode' });
  }
}
