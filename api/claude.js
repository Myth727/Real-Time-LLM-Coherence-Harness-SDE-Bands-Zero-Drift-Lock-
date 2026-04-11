// api/claude.js
// Vercel serverless function — proxies requests to Anthropic API.
// Your ANTHROPIC_API_KEY environment variable is read here server-side.
// The browser never sees the key.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read the key the user typed into the ARCHITECT key field
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      error: "No API key provided. Enter your Anthropic API key in the ARCHITECT key field."
    });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error", detail: err.message });
  }
}
