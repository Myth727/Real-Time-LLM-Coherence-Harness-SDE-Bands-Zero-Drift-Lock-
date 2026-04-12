// public/embedder.worker.js
// Runs in a Web Worker — completely off the main thread.
// Downloads all-MiniLM-L6-v2 ONNX (~23MB) once, caches in IndexedDB.
// Subsequent loads are instant.

importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');

const { pipeline, env } = self.transformers || Transformers;

// Cache model in IndexedDB — only downloads once ever
env.useBrowserCache = true;
env.allowLocalModels = false;

let embedder = null;
let ready = false;

async function init() {
  try {
    self.postMessage({ type: 'status', message: 'Downloading semantic model (~23MB, first load only)...' });
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    ready = true;
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
}

self.onmessage = async (event) => {
  const { type, text, id } = event.data;

  if (type === 'init') {
    await init();
    return;
  }

  if (type === 'embed') {
    if (!ready) {
      self.postMessage({ type: 'error', id, message: 'Embedder not ready' });
      return;
    }
    try {
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      self.postMessage({ type: 'result', id, embedding: Array.from(output.data) });
    } catch (err) {
      self.postMessage({ type: 'error', id, message: err.message });
    }
  }
};

// Auto-initialize on load
init();
