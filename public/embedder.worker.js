// public/embedder.worker.js
// Web Worker for all-MiniLM-L6-v2 semantic embeddings.
// Uses @xenova/transformers via CDN with ES module dynamic import.
// Model (~23MB) cached in IndexedDB after first download.

let embedder = null;
let ready = false;

async function init() {
  try {
    self.postMessage({ type: 'status', message: 'Loading semantic model...' });

    const { pipeline, env } = await import(
      'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
    );

    env.useBrowserCache = true;
    env.allowLocalModels = false;

    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    ready = true;
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
}

self.onmessage = async (event) => {
  const { type, text, id } = event.data;
  if (type === 'init') { await init(); return; }
  if (type === 'embed') {
    if (!ready) {
      self.postMessage({ type: 'error', id, message: 'Embedder not ready' });
      return;
    }
    try {
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      self.postMessage({ type: 'result', id, embedding: Array.from(output.data) });
    } catch (err) {
      self.postMessage({ type: 'error', id, message: String(err) });
    }
  }
};

init();
