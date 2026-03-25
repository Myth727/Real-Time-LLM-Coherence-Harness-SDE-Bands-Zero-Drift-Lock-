# Security Policy

## API Key Handling

ARCHITECT requires an Anthropic API key entered directly in the browser UI.

**Important:** The API key is transmitted directly from your browser to the Anthropic API endpoint. It is never sent to any other server. There is no backend, no proxy, and no third-party service involved beyond Anthropic.

However, entering an API key in a browser-based tool carries inherent risk:
- The key is visible in browser memory
- If running in a shared or untrusted environment, the key could be exposed
- For production use, route API calls through a backend proxy at `/api/claude` (the endpoint is configurable at the top of `ARCHITECT.jsx`)

**For local/research use:** entering your key directly is acceptable.  
**For shared or deployed use:** set up a proxy and remove client-side key handling.

## Reporting Vulnerabilities

If you discover a security issue in this project, please open a GitHub issue tagged `[security]` or contact directly via X:
- @Prosperous727
- @RaccoonStampede

Please do not publicly disclose security issues before they have been reviewed.

## Scope

This project is R&D software. It is not intended for production deployment handling sensitive data. The primary security consideration is API key exposure as described above.

## No Warranty

This software is provided as-is with no warranty. See LICENSE for full terms.
