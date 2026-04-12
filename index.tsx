// pages/index.tsx
import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Load ARCHITECT client-side only — it uses browser APIs
const ARCHITECT = dynamic(() => import('../components/ARCHITECT'), { ssr: false });

// ── window.storage polyfill ─────────────────────────────────────
// ARCHITECT uses window.storage (Claude artifact API).
// This maps it to localStorage so all persist/restore calls work unchanged.
function installStoragePolyfill() {
  if (typeof window === 'undefined') return;
  if ((window as any).storage) return; // already installed
  (window as any).storage = {
    get: async (key: string) => {
      const val = localStorage.getItem(key);
      if (val === null) throw new Error(`Key not found: ${key}`);
      return { key, value: val, shared: false };
    },
    set: async (key: string, value: string) => {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    delete: async (key: string) => {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    list: async (prefix?: string) => {
      const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
      return { keys, shared: false };
    },
  };
}

const Home: NextPage = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    installStoragePolyfill();
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{
        background: '#0E1C2A', height: '100vh', width: '100vw',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Courier New, monospace', color: '#2E5070',
        fontSize: 12, letterSpacing: 2,
      }}>
        LOADING ARCHITECT...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>ARCHITECT — Universal Coherence Engine V2.0</title>
        <meta name="description" content="Real-time LLM coherence monitoring — Hudson & Perry Research" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <ARCHITECT />
    </>
  );
};

export default Home;
