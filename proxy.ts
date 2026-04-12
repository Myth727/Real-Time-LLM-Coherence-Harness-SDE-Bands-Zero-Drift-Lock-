// pages/api/proxy.ts
// Multi-provider serverless proxy.
// User's key is passed from the browser in x-api-key header.
// Provider is identified by x-architect-provider header.
// Key never stored server-side — each user provides their own.

import type { NextApiRequest, NextApiResponse } from 'next';

const PROVIDERS: Record<string, { endpoint: string; format: 'anthropic' | 'openai' }> = {
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    format: 'anthropic',
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    format: 'openai',
  },
  grok: {
    endpoint: 'https://api.x.ai/v1/chat/completions',
    format: 'openai', // Grok is OpenAI-compatible
  },
};

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai:    'gpt-4o',
  grok:      'grok-3',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey   = req.headers['x-api-key'] as string;
  const provider = (req.headers['x-architect-provider'] as string) || 'anthropic';

  if (!apiKey) {
    return res.status(401).json({
      error: 'No API key provided. Enter your key in the ARCHITECT key field.',
    });
  }

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  try {
    let requestBody: any;
    let requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (providerConfig.format === 'anthropic') {
      // Anthropic format — pass through as-is
      requestHeaders['x-api-key'] = apiKey;
      requestHeaders['anthropic-version'] = '2023-06-01';
      requestBody = req.body;
    } else {
      // OpenAI-compatible format (OpenAI, Grok)
      // Convert from Anthropic message format to OpenAI format
      requestHeaders['Authorization'] = `Bearer ${apiKey}`;
      const { messages, system, max_tokens } = req.body;
      const oaiMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;
      requestBody = {
        model: req.body.model || DEFAULT_MODELS[provider],
        max_tokens: max_tokens || 1000,
        messages: oaiMessages,
      };
    }

    const response = await fetch(providerConfig.endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Normalize OpenAI response to Anthropic format so ARCHITECT.jsx
    // doesn't need to know about provider differences
    if (providerConfig.format === 'openai') {
      const normalized = {
        content: [{
          type: 'text',
          text: data.choices?.[0]?.message?.content || '',
        }],
        stop_reason: data.choices?.[0]?.finish_reason || 'end_turn',
        model: data.model,
      };
      return res.status(200).json(normalized);
    }

    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
