import React, { useState } from 'react';

const MAPPING = {
  A: { name: 'Ael', pron: 'ah-el' },
  B: { name: 'Bryn', pron: 'brin' },
  C: { name: 'Caith', pron: 'kayth' },
  D: { name: 'Drael', pron: 'dray-el' },
  E: { name: 'Esh', pron: 'esh' },
  F: { name: 'Faen', pron: 'fayn' },
  G: { name: 'Ghor', pron: 'gor' },
  H: { name: 'Hael', pron: 'hayl' },
  I: { name: 'Iryn', pron: 'ee-rin' },
  J: { name: 'Jaex', pron: 'jayks' },
  K: { name: 'Kael', pron: 'kayl' },
  L: { name: 'Lyr', pron: 'leer' },
  M: { name: 'Myr', pron: 'meer' },
  N: { name: 'Nyx', pron: 'niks' },
  O: { name: 'Oryn', pron: 'oh-rin' },
  P: { name: 'Prae', pron: 'pray' },
  Q: { name: 'Qyth', pron: 'kweeth' },
  R: { name: 'Rael', pron: 'ray-el' },
  S: { name: 'Syth', pron: 'seeth' },
  T: { name: 'Thaen', pron: 'thayn' },
  U: { name: 'Uvyr', pron: 'oo-veer' },
  V: { name: 'Vael', pron: 'vayl' },
  W: { name: 'Wyrn', pron: 'weern' },
  X: { name: 'Xaith', pron: 'zayth' },
  Y: { name: 'Yrael', pron: 'yee-rayl' },
  Z: { name: 'Zyrr', pron: 'zeer' }
};

const nameToLetter = {};
const pronToLetter = {};
Object.entries(MAPPING).forEach(([k, v]) => {
  nameToLetter[v.name.toLowerCase()] = k;
  pronToLetter[v.pron.toLowerCase()] = k;
});

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

export default function Translator() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  function englishToVeyrith(text) {
    // words separated by whitespace
    return text
      .split(/\s+/)
      .map((word) =>
        word
          .split('')
          .map((ch) => {
            const up = ch.toUpperCase();
            if (up >= 'A' && up <= 'Z' && MAPPING[up]) return MAPPING[up].name;
            return ch; // preserve punctuation
          })
          .join('-')
      )
      .join(' / ');
  }

  function veyrithToEnglish(text) {
    // Accept words separated by ' / ' (the translator's word separator)
    const words = text.split(/\s*\/\s*/).filter(Boolean);
    return words
      .map((w) => {
        // tokens may be separated by '-' or whitespace
        const tokens = w.split(/\s*-\s*/).filter(Boolean);
        return tokens
          .map((tok) => {
            const clean = tok.trim();
            if (!clean) return '';
            const lower = clean.toLowerCase();
            if (nameToLetter[lower]) return nameToLetter[lower];
            if (pronToLetter[lower]) return pronToLetter[lower];
            // maybe single-letter already
            if (clean.length === 1 && /[a-zA-Z]/.test(clean)) return clean.toUpperCase();
            // unknown token -> keep as-is (preserve punctuation)
            return '';
          })
          .join('');
      })
      .join(' ');
  }

  function handleToVeyrith() {
    setOutput(englishToVeyrith(input || ''));
  }

  function handleToEnglish() {
    setOutput(veyrithToEnglish(input || ''));
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard?.writeText(output);
  }

  function handleClear() {
    setInput('');
    setOutput('');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Translator — English ⇄ Veyrith</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 font-medium">Input</label>
          <textarea
            className="w-full h-48 p-3 rounded border border-border bg-input text-foreground"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or paste English or Veyrith here"
          />

          <div className="flex gap-2 mt-3">
            <button
              className="px-3 py-2 bg-primary text-primary-foreground rounded"
              onClick={handleToVeyrith}
            >
              To Veyrith
            </button>
            <button
              className="px-3 py-2 bg-accent text-foreground rounded"
              onClick={handleToEnglish}
            >
              To English
            </button>
            <button className="px-3 py-2 bg-muted-foreground text-background rounded" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>

        <div>
          <label className="block mb-2 font-medium">Output</label>
          <textarea
            readOnly
            className="w-full h-48 p-3 rounded border border-border bg-input text-foreground"
            value={output}
            placeholder="Translation appears here"
          />

          <div className="flex gap-2 mt-3">
            <button className="px-3 py-2 bg-emerald-600 text-white rounded" onClick={handleCopy}>
              Copy Output
            </button>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>Usage notes:</p>
            <ul className="list-disc ml-5">
              <li>English → Veyrith: letters mapped to Veyrith names, letters separated by <code>-</code>, words separated by <code>/</code>.</li>
              <li>Veyrith → English: accepts names (e.g. <em>Ael</em>) or pronunciations (e.g. <em>ah-el</em>).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
