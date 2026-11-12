import React, { useEffect, useRef, useState } from 'react';

const C = [
  { n: 'Travis Bickle', f: 'Taxi Driver, 1976', a: '#E9A210', rx: 56, ry: 72, sw: 118 },
  { n: 'Young Vito Corleone', f: 'The Godfather Part II, 1974', a: '#C4572B', rx: 62, ry: 74, sw: 128 },
  { n: 'Jake LaMotta', f: 'Raging Bull, 1980', a: '#E0334A', rx: 64, ry: 70, sw: 132 },
  { n: 'Jimmy Conway', f: 'Goodfellas, 1990', a: '#14A98C', rx: 58, ry: 75, sw: 122 },
  { n: 'Sam Rothstein', f: 'Casino, 1995', a: '#E23B93', rx: 57, ry: 76, sw: 126 },
  { n: 'Frank Sheeran', f: 'The Irishman, 2019', a: '#4A86E8', rx: 61, ry: 78, sw: 120 },
];

const INTRO = 900;
const D = 700;
const FIN = 1000;
const END = INTRO + C.length * D;

const CSS = `
.startup-splash{
  --bg:#E9ECF0;--ink:#13151A;--mute:#5A6270;--grain:.07;--acc:#888;
  position:fixed;inset:0;z-index:2147483000;overflow:hidden;
  background:var(--bg);color:var(--ink);
  font-family:"Instrument Sans",system-ui,sans-serif;
  box-sizing:border-box;user-select:none;
  opacity:1;transition:opacity .45s ease;
  padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);
}
.startup-splash.dark{--bg:#15171C;--ink:#F1F2F4;--mute:#9AA2AE;--grain:.09}
.startup-splash.exiting{opacity:0;pointer-events:none}
.startup-splash *{box-sizing:border-box}
.startup-splash .sp-wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
.startup-splash .spot{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--acc) 30%,transparent),transparent 58%);pointer-events:none}
.startup-splash .grain{position:absolute;inset:0;pointer-events:none;opacity:var(--grain);background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>");mix-blend-mode:multiply}
.startup-splash.dark .grain{mix-blend-mode:screen}
.startup-splash .stage{position:relative;width:min(74vmin,400px);aspect-ratio:400/440;filter:drop-shadow(0 0 22px color-mix(in srgb,var(--acc) 55%,transparent))}
.startup-splash svg{width:100%;height:100%;overflow:visible;display:block}
.startup-splash .prop{opacity:0;transform-box:view-box;transform-origin:200px 230px}
.startup-splash .cap{text-align:center;min-height:84px;position:relative}
.startup-splash .name{font-family:"Bodoni Moda",Georgia,serif;font-weight:600;font-size:clamp(26px,6.2vmin,40px);letter-spacing:.01em;margin:0}
.startup-splash .film{font-size:14px;color:var(--mute);margin:6px 0 0;letter-spacing:.04em}
.startup-splash .ticks{display:flex;gap:6px;justify-content:center;margin-top:12px}
.startup-splash .ticks i{width:26px;height:3px;border-radius:2px;background:var(--mute);opacity:.28;transition:opacity .2s,background .2s}
.startup-splash .ticks i.on{opacity:1;background:var(--acc)}
.startup-splash .word{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;pointer-events:none;text-align:center}
.startup-splash .word h1{font-family:"Bodoni Moda",Georgia,serif;font-style:italic;font-weight:500;font-size:clamp(44px,13vmin,92px);margin:0;letter-spacing:.01em}
.startup-splash .word p{margin:10px 0 0;color:var(--mute);font-size:15px;letter-spacing:.06em}
.startup-splash .word .ln{width:0;height:2px;background:var(--acc);margin-top:18px}
`;

export default function StartupSplash() {
  const rootRef = useRef(null);
  const [phase, setPhase] = useState('playing');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const docRoot = document.documentElement;
    const syncTheme = () => root.classList.toggle('dark', docRoot.classList.contains('dark'));
    syncTheme();
    window.addEventListener('bickle-theme-change', syncTheme);

    const $ = (id) => root.querySelector(`.${id}`);
    const head = $('sp-head');
    const body = $('sp-body');
    const hf = $('sp-hf');
    const bf = $('sp-bf');
    const ring = $('sp-ring');
    const fig = $('sp-fig');
    const stage = $('stage');
    const cap = $('cap');
    const word = $('word');
    const nm = $('name');
    const fl = $('film');
    const props = [].slice.call(root.querySelectorAll('.prop'));
    const ticks = [].slice.call($('ticks').children);
    const ln = word.querySelector('.ln');

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let exitTimer = 0;
    let t0 = 0;
    let lastK = -2;
    let finished = false;

    const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const J = [1, 0.93, 1.05, 0.96, 1.04, 0.92, 1.03, 0.97, 1.05, 0.94, 1.02, 0.95];
    const HO = [0, 0.14, 0.05, 0.2, 0.08, 0.16, 0, 0.12, 0.18, 0.04, 0.13, 0.07];
    const BO = [0.1, 0, 0.16, 0.06, 0.18, 0, 0.12];

    const scheduleExit = (ms) => {
      if (finished) return;
      finished = true;
      exitTimer = setTimeout(() => setPhase('exiting'), ms);
    };

    const poly = (el, pts) => {
      el.setAttribute(
        'points',
        pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
      );
    };

    const fan = (g, pts, c, closed, op) => {
      const n = closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i += 1) {
        let e = g.children[i];
        if (!e) {
          e = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          e.setAttribute('fill', 'var(--bg)');
          e.setAttribute('fill-opacity', op[i % op.length]);
          g.appendChild(e);
        }
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        e.setAttribute(
          'd',
          `M${c[0]} ${c[1]}L${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}Z`
        );
      }
    };

    const setRing = (r, o) => {
      const p = [];
      for (let i = 0; i < 6; i += 1) {
        const a = (i * Math.PI) / 3 + r * 0.012;
        p.push([200 + r * Math.cos(a), 215 + r * Math.sin(a)]);
      }
      poly(ring, p);
      ring.setAttribute('opacity', o);
    };

    const eo = (x) => 1 - Math.pow(1 - x, 3);
    const hx = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
    const mix = (a, b, m) => {
      const A = hx(a);
      const B = hx(b);
      return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * m)).join(',')})`;
    };

    const shape = (rx, ry, sw) => {
      const hp = [];
      for (let i = 0; i < 12; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 6;
        const c = Math.cos(a);
        const s = Math.sin(a);
        hp.push([200 + rx * c * J[i] * (s > 0.5 ? 0.8 : 1), 172 + ry * s * J[i]]);
      }
      poly(head, hp);
      fan(hf, hp, [200, 168], true, HO);
      const l = 200 - sw;
      const r = 200 + sw;
      const bp = [
        [l, 440],
        [l + sw * 0.1, 365],
        [200 - sw * 0.55, 318],
        [176, 300],
        [224, 300],
        [200 + sw * 0.55, 318],
        [r - sw * 0.1, 365],
        [r, 440],
      ];
      poly(body, bp);
      fan(bf, bp, [200, 392], false, BO);
    };

    const setProp = (i, o) => {
      const g = props[i];
      g.style.opacity = o;
      g.style.transform = `scale(${1 + 0.07 * (1 - o)})`;
      g.style.filter = o < 1 ? `blur(${((1 - o) * 5).toFixed(1)}px)` : 'none';
    };

    const label = (k) => {
      nm.textContent = C[k].n;
      fl.textContent = C[k].f;
      ticks.forEach((t, i) => {
        t.className = i <= k ? 'on' : '';
      });
      cap.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
        duration: 260,
        easing: 'ease-out',
      });
    };

    const reset = () => {
      props.forEach((g, i) => setProp(i, 0));
      stage.style.opacity = 1;
      cap.style.opacity = 1;
      word.style.opacity = 0;
      ln.style.width = '0';
      fig.style.opacity = 0;
      ring.setAttribute('opacity', 0);
      lastK = -2;
      nm.innerHTML = '&nbsp;';
      fl.innerHTML = '&nbsp;';
      ticks.forEach((t) => {
        t.className = '';
      });
    };

    const finale = (f) => {
      stage.style.opacity = 1 - f;
      cap.style.opacity = 1 - f;
      word.style.opacity = f;
      ln.style.width = `${f * 180}px`;
    };

    const frame = (now) => {
      const t = now - t0;
      if (t < INTRO) {
        const p = eo(t / INTRO);
        const A = C[0];
        shape(A.rx, A.ry, A.sw);
        root.style.setProperty('--acc', A.a);
        fig.style.opacity = p;
        fig.style.transform = `scale(${0.88 + 0.12 * p})`;
        setRing(30 + p * 240, (1 - p) * 0.7);
      } else if (t < END) {
        fig.style.opacity = 1;
        fig.style.transform = 'none';
        const k = Math.floor((t - INTRO) / D);
        const q = ((t - INTRO) % D) / D;
        const m = eo(cl(q / 0.6));
        const A = C[Math.max(0, k - 1)];
        const B = C[k];
        shape(A.rx + (B.rx - A.rx) * m, A.ry + (B.ry - A.ry) * m, A.sw + (B.sw - A.sw) * m);
        root.style.setProperty('--acc', mix(A.a, B.a, m));
        if (k !== lastK) {
          lastK = k;
          label(k);
          props.forEach((g, i) => {
            if (i !== k && i !== k - 1) setProp(i, 0);
          });
        }
        setProp(k, eo(cl(q / 0.45)));
        if (k > 0) setProp(k - 1, 1 - cl(q / 0.3));
        setRing(50 + q * 230, (1 - q) * 0.75);
      } else {
        const f = cl((t - END) / FIN);
        props.forEach((g, i) => setProp(i, 0));
        finale(eo(f));
        if (f >= 1) {
          scheduleExit(700);
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      cancelAnimationFrame(raf);
      reset();
      if (reduce) {
        root.style.setProperty('--acc', C[5].a);
        finale(1);
        scheduleExit(1200);
        return;
      }
      shape(C[0].rx, C[0].ry, C[0].sw);
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    };

    play();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(exitTimer);
      window.removeEventListener('bickle-theme-change', syncTheme);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'exiting') return undefined;
    const timer = setTimeout(() => setPhase('gone'), 500);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={rootRef}
        className={`startup-splash${phase === 'exiting' ? ' exiting' : ''}`}
        aria-label="Bickle starting"
      >
        <div className="sp-wrap">
          <div className="spot" />
          <div className="grain" />

          <div className="stage" id="stage">
            <svg viewBox="0 0 400 440" role="img" aria-label="Stylised silhouette morphing through six character looks">
              <polygon className="sp-ring" id="sp-ring" points="" fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinejoin="miter" opacity="0" />
              <g className="sp-fig" id="sp-fig" style={{ transformBox: 'view-box', transformOrigin: '200px 260px' }}>
                <rect x="178" y="225" width="44" height="90" fill="var(--ink)" />
                <polygon className="sp-body" id="sp-body" fill="var(--ink)" stroke="var(--acc)" strokeWidth="2.5" strokeLinejoin="miter" />
                <g className="sp-bf" id="sp-bf" />
                <polygon className="sp-head" id="sp-head" fill="var(--ink)" stroke="var(--acc)" strokeWidth="2.5" strokeLinejoin="miter" />
                <g className="sp-hf" id="sp-hf" />

                {/* 0 Travis Bickle: mohawk + field jacket */}
                <g className="prop" fill="var(--acc)" stroke="var(--bg)" strokeWidth="3" strokeLinejoin="round">
                  <path d="M184 108 L200 44 L216 108 Z" />
                  <path d="M148 300 L200 346 L170 440 L120 440Z" />
                  <path d="M252 300 L200 346 L230 440 L280 440Z" />
                  <path d="M200 346 V440" fill="none" />
                </g>
                {/* 1 Vito: fedora + lapels + rose */}
                <g className="prop" stroke="var(--bg)" strokeWidth="3" strokeLinejoin="round">
                  <path d="M100 116 L132 106 L200 100 L268 106 L300 116 L268 126 L200 132 L132 126Z" fill="var(--ink)" />
                  <path d="M150 112 L162 76 L200 62 L238 76 L250 112Z" fill="var(--ink)" />
                  <path d="M150 100 L250 100 L252 114 L148 114Z" fill="var(--acc)" stroke="none" />
                  <path d="M184 300 L200 338 L216 300Z" fill="var(--bg)" stroke="none" />
                  <path d="M200 300 L166 362 L198 440 M200 300 L234 362 L202 440" fill="none" strokeWidth="4" />
                  <path d="M228 339 L237 348 L228 357 L219 348Z" fill="var(--acc)" stroke="none" />
                </g>
                {/* 2 Jake: gloves + ring ropes + brow cut */}
                <g className="prop" fill="var(--acc)" stroke="var(--bg)" strokeWidth="3" strokeLinejoin="round">
                  <path d="M90 334 L123 353 L123 391 L90 410 L57 391 L57 353Z M310 334 L343 353 L343 391 L310 410 L277 391 L277 353Z" />
                  <path d="M58 402 H122 V430 H58Z M278 402 H342 V430 H278Z" />
                  <path d="M0 322 H48 M0 364 H34 M352 322 H400 M366 364 H400" fill="none" stroke="var(--acc)" strokeWidth="5" />
                  <path d="M170 148 L190 142 M200 176 L211 185 L202 194" fill="none" stroke="var(--bg)" strokeWidth="3.5" strokeLinecap="round" />
                </g>
                {/* 3 Jimmy: flat cap + loosened tie */}
                <g className="prop" stroke="var(--bg)" strokeWidth="3" strokeLinejoin="round">
                  <path d="M140 126 L152 92 L200 78 L248 92 L260 126Z" fill="var(--ink)" />
                  <path d="M136 124 L200 142 L266 124 L274 134 L200 154 L130 136Z" fill="var(--acc)" stroke="none" />
                  <path d="M200 75 L206 82 L200 89 L194 82Z" fill="var(--acc)" stroke="none" />
                  <path d="M176 300 L200 334 L224 300Z" fill="var(--bg)" stroke="none" />
                  <path d="M193 326 H207 L214 384 L200 402 L186 384Z" fill="var(--acc)" />
                  <path d="M200 300 L160 356 L192 440 M200 300 L240 356 L208 440" fill="none" strokeWidth="4" />
                </g>
                {/* 4 Sam: shades + wide lapels + pocket square + chip */}
                <g className="prop" stroke="var(--bg)" strokeWidth="3" strokeLinejoin="round">
                  <path d="M138 158 L150 150 L184 150 L190 162 L184 178 L150 178Z M262 158 L250 150 L216 150 L210 162 L216 178 L250 178Z" fill="var(--acc)" />
                  <path d="M190 160 H210" stroke="var(--acc)" strokeWidth="5" fill="none" />
                  <path d="M200 300 L144 356 L188 440 M200 300 L256 356 L212 440" fill="none" strokeWidth="4.5" />
                  <path d="M240 350 L268 346 L262 368 L244 362Z" fill="var(--acc)" stroke="none" />
                  <path d="M332 79 L352 88 L361 108 L352 128 L332 137 L312 128 L303 108 L312 88Z" fill="none" stroke="var(--acc)" strokeWidth="8" />
                  <path d="M332 93 L345 100 L345 116 L332 123 L319 116 L319 100Z" fill="var(--acc)" stroke="none" />
                </g>
                {/* 5 Frank: white hair + glasses + tie + lines */}
                <g className="prop" strokeLinejoin="round">
                  <path d="M144 152 L136 122 L164 98 L200 92 L236 98 L264 122 L256 152 L240 124 L200 114 L160 124Z" fill="#B9C0CB" stroke="var(--ink)" strokeWidth="3" />
                  <g fill="none" stroke="var(--acc)" strokeWidth="4.5">
                    <path d="M172 150 L186 156 L192 170 L186 184 L172 190 L158 184 L152 170 L158 156Z M228 150 L242 156 L248 170 L242 184 L228 190 L214 184 L208 170 L214 156Z" />
                    <path d="M192 168 H208" />
                  </g>
                  <path d="M166 140 L200 131 L234 140 M172 214 L200 223 L228 214" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M182 300 L200 330 L218 300Z" fill="var(--bg)" />
                  <path d="M200 316 L188 348 L200 440 L212 348Z" fill="var(--acc)" stroke="var(--bg)" strokeWidth="3" />
                </g>
              </g>
            </svg>
          </div>

          <div className="cap" id="cap">
            <p className="name" id="name">&nbsp;</p>
            <p className="film" id="film">&nbsp;</p>
            <div className="ticks" id="ticks">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="word" id="word">
            <h1>Bickle</h1>
            <div className="ln" />
          </div>
        </div>
      </div>
    </>
  );
}
