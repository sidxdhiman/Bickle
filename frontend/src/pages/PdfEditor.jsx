import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MousePointer2, Type, ScanText, RemoveFormatting, Highlighter, Square,
  Pencil, Image as ImageIcon, Stamp, Eraser, Undo2, Redo2, Trash2, Loader2,
  Check, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2,
  Upload, Download, FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PdfEditorSkeleton } from '../components/Skeletons';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#111827', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
const FONT_SIZES = [10, 12, 16, 24, 36];
const STROKE_WIDTHS = [1, 2, 4, 6];
const FONTS = [
  { id: 'helvetica', label: 'Sans', css: 'Helvetica, Arial, sans-serif' },
  { id: 'times', label: 'Serif', css: 'Times New Roman, Times, serif' },
  { id: 'courier', label: 'Mono', css: 'Courier New, monospace' },
];

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const hexToRgb = (hex) => {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};

const dataUrlToBytes = (dataUrl) => {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
};

const pointsToPath = (pts) => {
  if (!pts || !pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d;
};

const BOX_TYPES = ['remove', 'highlight', 'rect', 'image', 'signature'];

const getAnnBounds = (a) => {
  if (a.type === 'draw') {
    const xs = a.points.map(p => p.x);
    const ys = a.points.map(p => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  if (a.type === 'text') {
    const lines = (a.text || '').split('\n');
    const w = Math.max(...lines.map(l => l.length)) * a.size * 0.55;
    return { x: a.x, y: a.baseline - a.size * 0.85, w, h: lines.length * a.size * 1.2 };
  }
  return { x: a.x, y: a.y, w: a.w, h: a.h };
};

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select & move', key: 'V' },
  { id: 'text', icon: Type, label: 'Add text', key: 'T' },
  { id: 'edittext', icon: ScanText, label: 'Detect & edit text', key: 'D' },
  { id: 'remove', icon: RemoveFormatting, label: 'Remove content', key: 'E' },
  { id: 'highlight', icon: Highlighter, label: 'Highlight', key: 'H' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'draw', icon: Pencil, label: 'Freehand draw', key: 'P' },
  { id: 'image', icon: ImageIcon, label: 'Insert image', key: 'I' },
  { id: 'signature', icon: Stamp, label: 'Add signature', key: 'S' },
  { id: 'eraser', icon: Eraser, label: 'Erase object', key: 'X' },
];

const SignatureModal = ({ isOpen, onClose, onApply }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [color, setColor] = useState('#111827');
  const [width, setWidth] = useState(3);
  const last = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 520;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    last.current = null;
  }, [isOpen]);

  if (!isOpen) return null;

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current.height / rect.height),
    };
  };

  const start = (e) => {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current.setPointerCapture(e.pointerId);
  };

  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const apply = () => {
    onApply(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">Draw your signature</h2>
          <button onClick={onClose} className="p-2 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-lg overflow-hidden border border-border bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none cursor-crosshair"
              style={{ aspectRatio: '520 / 220' }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn('w-5 h-5 rounded-full border-2 transition-all', color === c ? 'border-foreground scale-110' : 'border-border')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {STROKE_WIDTHS.map(w => (
                <button
                  key={w}
                  onClick={() => setWidth(w)}
                  className={cn('w-7 h-7 rounded-md border flex items-center justify-center', width === w ? 'border-primary bg-primary/10' : 'border-border')}
                >
                  <span className="rounded-full bg-foreground" style={{ width: w + 4, height: w }} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end p-4 border-t border-border">
          <button onClick={clear} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm font-medium">Clear</button>
          <button onClick={onClose} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm font-medium">Cancel</button>
          <button onClick={apply} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium">
            <Check className="w-4 h-4" /> Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const PdfEditor = () => {
  const [pdf, setPdf] = useState(null);
  const [fileName, setFileName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0); // active (most visible) page
  const [pageDims, setPageDims] = useState([]); // per-page { w, h } at scale 1
  const [scale, setScale] = useState(1.1);
  const [textItemsMap, setTextItemsMap] = useState({}); // page -> extracted text items
  const [annotations, setAnnotations] = useState([]);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [appearance, setAppearance] = useState({
    color: '#111827', fontFamily: 'helvetica', fontSize: 16, strokeWidth: 2,
  });
  const [editing, setEditing] = useState(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [loading, setLoading] = useState(false);
  const [renderBusy, setRenderBusy] = useState({});
  const [exporting, setExporting] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [visiblePages, setVisiblePages] = useState(() => new Set([0]));

  const pdfjsRef = useRef(null);
  const pdfBytesRef = useRef(null);
  const pageCacheRef = useRef({});
  const renderTasksRef = useRef({});
  const renderedRef = useRef({});
  const visibleRef = useRef(new Set([0]));
  const canvasRefs = useRef({});
  const pageElsRef = useRef({});
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const drawRef = useRef({ active: false });
  const dragRef = useRef({ active: false });
  const resizeRef = useRef({ active: false });
  const editingRef = useRef(null);
  const focusedRef = useRef(false);
  const scrollRafRef = useRef(null);
  const didMountRef = useRef(false);

  const loadPdfJs = async () => {
    if (pdfjsRef.current) return pdfjsRef.current;
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfjsRef.current = pdfjs;
    return pdfjs;
  };

  const openFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      window.alert('Please choose a PDF file.');
      return;
    }
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const original = new Uint8Array(buf);
      pdfBytesRef.current = original;
      Object.values(renderTasksRef.current).forEach(t => { try { t?.cancel(); } catch { /* ignore */ } });
      pageCacheRef.current = {};
      renderedRef.current = {};
      renderTasksRef.current = {};
      canvasRefs.current = {};
      pageElsRef.current = {};
      visibleRef.current = new Set([0]);
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({
        data: original.slice(),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
      }).promise;
      const dims = await Promise.all(
        Array.from({ length: doc.numPages }, async (_, n) => {
          const pg = await doc.getPage(n + 1);
          const vp = pg.getViewport({ scale: 1 });
          return { w: vp.width, h: vp.height };
        })
      );
      const cw = containerRef.current?.clientWidth || 900;
      const fit = Math.min(1.6, Math.max(0.4, (cw - 64) / (dims[0]?.w || 612)));
      setPdf(doc);
      setNumPages(doc.numPages);
      setPageIndex(0);
      setPageDims(dims);
      setTextItemsMap({});
      setVisiblePages(new Set([0]));
      setScale(fit);
      setAnnotations([]);
      setPast([]);
      setFuture([]);
      setSelectedId(null);
      setFileName(file.name);
      setTool('select');
    } catch (err) {
      console.error('Failed to open PDF:', err);
      window.alert('Sorry, this PDF could not be opened.');
    } finally {
      setLoading(false);
    }
  };

  // Render one page's canvas (+ extract its text) on demand
  const renderPageTo = useCallback(async (i) => {
    if (!pdf) return;
    const canvas = canvasRefs.current[i];
    if (!canvas) return;
    const key = `${i}:${scale}`;
    if (renderedRef.current[i] === key) return;
    setRenderBusy(m => ({ ...m, [i]: true }));
    try {
      const page = await pdf.getPage(i + 1);
      let cached = pageCacheRef.current[i];
      if (!cached) {
        const vp1 = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const pdfjs = pdfjsRef.current;
        const items = tc.items
          .filter(it => it.str && it.str.trim())
          .map(it => {
            const t = pdfjs.Util.transform(vp1.transform, it.transform);
            const fontHeight = Math.hypot(t[2], t[3]) || it.height || 12;
            return {
              id: uid(),
              str: it.str,
              x: t[4],
              baseline: t[5],
              fontHeight,
              w: it.width || it.str.length * fontHeight * 0.5,
              top: t[5] - fontHeight * 0.85,
              h: fontHeight * 1.15,
            };
          });
        cached = { w: vp1.width, h: vp1.height, items };
        pageCacheRef.current[i] = cached;
        setTextItemsMap(prev => (prev[i] ? prev : { ...prev, [i]: items }));
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      if (renderTasksRef.current[i]) {
        try { renderTasksRef.current[i].cancel(); } catch { /* ignore */ }
      }
      const task = page.render({ canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff' });
      renderTasksRef.current[i] = task;
      try { await task.promise; } catch (err) {
        if (err && err.name !== 'RenderingCancelledException') console.error(err);
      }
      renderedRef.current[i] = key;
    } catch (err) {
      console.error(`Failed to render page ${i + 1}:`, err);
    } finally {
      setRenderBusy(m => ({ ...m, [i]: false }));
    }
  }, [pdf, scale]);

  // Render pages that are (or are about to be) in view
  useEffect(() => {
    if (!pdf) return undefined;
    let cancelled = false;
    (async () => {
      const pages = [...visiblePages].sort((a, b) => a - b);
      for (const i of pages) {
        if (cancelled) return;
        await renderPageTo(i);
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, visiblePages, renderPageTo]);

  // Lazily track which pages are near the viewport
  useEffect(() => {
    if (!pdf || !pageDims.length) return undefined;
    const root = containerRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver((entries) => {
      let changed = false;
      const vis = new Set(visibleRef.current);
      for (const en of entries) {
        const i = Number(en.target.dataset.page);
        if (en.isIntersecting) { if (!vis.has(i)) { vis.add(i); changed = true; } }
        else if (vis.has(i)) { vis.delete(i); changed = true; }
      }
      if (changed) {
        visibleRef.current = vis;
        setVisiblePages(new Set(vis));
      }
    }, { root, rootMargin: '400px 0px', threshold: 0 });
    for (const el of Object.values(pageElsRef.current)) if (el) io.observe(el);
    return () => io.disconnect();
  }, [pdf, pageDims]);

  // Keep the toolbar page indicator in sync with the page under the viewport center
  const handleScroll = () => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const c = containerRef.current;
      if (!c) return;
      const cRect = c.getBoundingClientRect();
      const mid = cRect.top + cRect.height / 2;
      let best = 0;
      let bestDist = Infinity;
      for (const key of Object.keys(pageElsRef.current)) {
        const i = Number(key);
        const el = pageElsRef.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      setPageIndex(best);
    });
  };

  useEffect(() => () => {
    Object.values(renderTasksRef.current).forEach(t => { try { t?.cancel(); } catch { /* ignore */ } });
    cancelAnimationFrame(scrollRafRef.current);
  }, []);

  useEffect(() => { containerRef.current?.scrollTo({ top: 0 }); }, [pdf]);

  const pushHistory = useCallback(() => {
    setPast(prev => [...prev.slice(-49), annotations]);
    setFuture([]);
  }, [annotations]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const prior = past[past.length - 1];
    setFuture(f => [annotations, ...f]);
    setPast(p => p.slice(0, -1));
    setAnnotations(prior);
    setSelectedId(null);
  }, [past, annotations]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setPast(p => [...p, annotations]);
    setFuture(f => f.slice(1));
    setAnnotations(next);
    setSelectedId(null);
  }, [future, annotations]);

  const addAnnotation = (ann) => {
    pushHistory();
    setAnnotations(prev => [...prev, ann]);
  };

  const deleteAnnotation = (id) => {
    pushHistory();
    setAnnotations(prev => prev.filter(a => a.id !== id));
    setSelectedId(null);
  };

  const toInternal = useCallback((e, svg) => {
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }, [scale]);

  const openEditor = (payload) => {
    editingRef.current = payload;
    focusedRef.current = false;
    setEditing(payload);
  };

  const updateEditor = (updater) => {
    const next = updater(editingRef.current);
    editingRef.current = next;
    setEditing(next);
  };

  const commitEditor = useCallback(() => {
    const e = editingRef.current;
    if (!e) return;
    editingRef.current = null;
    setEditing(null);
    const pg = e.pageIndex ?? pageIndex;
    const value = e.value;
    if (!value.trim()) {
      if (e.id) {
        pushHistory();
        setAnnotations(prev => prev.filter(a => a.id !== e.id));
      }
      return;
    }
    pushHistory();
    if (e.detected) {
      const pad = 2;
      const wipe = {
        id: uid(), type: 'remove', pageIndex: pg,
        x: e.detected.x - pad, y: e.detected.top - pad,
        w: e.detected.w + pad * 2, h: e.detected.h + pad * 2,
      };
      const text = {
        id: uid(), type: 'text', pageIndex: pg,
        x: e.detected.x, baseline: e.detected.baseline,
        text: value, size: e.detected.fontHeight, color: e.color, fontFamily: e.fontFamily,
      };
      setAnnotations(prev => [...prev, wipe, text]);
    } else if (e.id) {
      setAnnotations(prev => prev.map(a => a.id === e.id ? { ...a, text: value, size: e.size, color: e.color, fontFamily: e.fontFamily } : a));
    } else {
      setAnnotations(prev => [...prev, {
        id: uid(), type: 'text', pageIndex: pg,
        x: e.x, baseline: e.baseline, text: value,
        size: e.size, color: e.color, fontFamily: e.fontFamily,
      }]);
    }
  }, [pageIndex, pushHistory]);

  const handleOverlayPointerDown = (e, i) => {
    if (editingRef.current) {
      commitEditor();
      return;
    }
    if (e.button !== 0) return;
    setPageIndex(i);
    const p = toInternal(e, e.currentTarget);

    if (tool === 'select') {
      setSelectedId(null);
      return;
    }
    if (tool === 'edittext' || tool === 'eraser' || tool === 'image' || tool === 'signature') return;

    if (tool === 'text') {
      // Cancel the browser's default mousedown focus steal — otherwise the
      // freshly mounted textarea is blurred instantly and the editor closes.
      e.preventDefault();
      const size = appearance.fontSize;
      openEditor({
        id: null, pageIndex: i, x: p.x, baseline: p.y + size * 0.82, value: '',
        size, color: appearance.color, fontFamily: appearance.fontFamily,
      });
      return;
    }

    drawRef.current = { active: true, mode: tool, start: p, points: [p], pageIndex: i };
    setDraft({ ...makeDraft(tool, p, p), pageIndex: i });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const makeDraft = (mode, start, cur) => {
    if (mode === 'draw') {
      return { id: 'draft', type: 'draw', points: [start, cur], color: appearance.color, strokeWidth: appearance.strokeWidth };
    }
    const x = Math.min(start.x, cur.x);
    const y = Math.min(start.y, cur.y);
    const w = Math.abs(cur.x - start.x);
    const h = Math.abs(cur.y - start.y);
    if (mode === 'remove') return { id: 'draft', type: 'remove', x, y, w, h };
    if (mode === 'highlight') return { id: 'draft', type: 'highlight', x, y, w, h, color: '#facc15' };
    return { id: 'draft', type: 'rect', x, y, w, h, color: appearance.color, strokeWidth: appearance.strokeWidth };
  };

  const handleOverlayPointerMove = (e) => {
    if (dragRef.current.active) {
      const d = dragRef.current;
      const p = toInternal(e, e.currentTarget);
      const dx = p.x - d.last.x;
      const dy = p.y - d.last.y;
      d.last = p;
      if (!d.moved) { d.moved = true; pushHistory(); }
      setAnnotations(prev => prev.map(a => {
        if (a.id !== d.id) return a;
        if (a.type === 'draw') return { ...a, points: a.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
        if (a.type === 'text') return { ...a, x: a.x + dx, baseline: a.baseline + dy };
        return { ...a, x: a.x + dx, y: a.y + dy };
      }));
      return;
    }
    if (resizeRef.current.active) {
      const r = resizeRef.current;
      const p = toInternal(e, e.currentTarget);
      const w = Math.max(8, p.x - r.x);
      const h = Math.max(8, p.y - r.y);
      setAnnotations(prev => prev.map(a => {
        if (a.id !== r.id) return a;
        if (r.keepRatio) {
          const hh = w / r.ratio;
          return { ...a, w, h: hh };
        }
        return { ...a, w, h };
      }));
      return;
    }
    const d = drawRef.current;
    if (!d.active) return;
    const p = toInternal(e, e.currentTarget);
    if (d.mode === 'draw') {
      const lastP = d.points[d.points.length - 1];
      if (Math.hypot(p.x - lastP.x, p.y - lastP.y) > 1) {
        d.points.push(p);
        setDraft({ id: 'draft', type: 'draw', points: d.points.slice(), color: appearance.color, strokeWidth: appearance.strokeWidth, pageIndex: d.pageIndex });
      }
    } else {
      d.cur = p;
      setDraft({ ...makeDraft(d.mode, d.start, p), pageIndex: d.pageIndex });
    }
  };

  const handleOverlayPointerUp = () => {
    if (dragRef.current.active) { dragRef.current.active = false; return; }
    if (resizeRef.current.active) { resizeRef.current.active = false; return; }
    const d = drawRef.current;
    if (!d.active) return;
    d.active = false;
    setDraft(null);
    if (d.mode === 'draw') {
      if (d.points.length < 2) return;
      addAnnotation({ id: uid(), type: 'draw', pageIndex: d.pageIndex, points: d.points.slice(), color: appearance.color, strokeWidth: appearance.strokeWidth });
    } else {
      const finalShape = makeDraft(d.mode, d.start, d.cur || d.start);
      if (finalShape.w < 4 || finalShape.h < 4) return;
      addAnnotation({ ...finalShape, id: uid(), pageIndex: d.pageIndex });
    }
  };

  const handleObjectPointerDown = (e, a) => {
    if (tool === 'eraser') {
      e.stopPropagation();
      deleteAnnotation(a.id);
      return;
    }
    if (tool !== 'select') return;
    e.stopPropagation();
    if (editingRef.current) { commitEditor(); return; }
    setSelectedId(a.id);
    setPageIndex(a.pageIndex);
    const svg = e.currentTarget.ownerSVGElement;
    dragRef.current = { active: true, id: a.id, moved: false, last: toInternal(e, svg) };
    svg.setPointerCapture(e.pointerId);
  };

  const startResize = (e, a) => {
    e.stopPropagation();
    const b = getAnnBounds(a);
    const svg = e.currentTarget.ownerSVGElement;
    resizeRef.current = {
      active: true, id: a.id, x: b.x, y: b.y,
      keepRatio: a.type === 'image' || a.type === 'signature',
      ratio: b.w / (b.h || 1),
    };
    svg.setPointerCapture(e.pointerId);
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dim = pageDims[pageIndex] || { w: 612, h: 792 };
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new window.Image();
      img.onload = () => {
        const maxW = Math.min(dim.w * 0.4, 260);
        const ratio = img.height / img.width;
        const w = maxW;
        const h = maxW * ratio;
        addAnnotation({
          id: uid(), type: 'image', pageIndex,
          x: (dim.w - w) / 2, y: Math.max(20, dim.h * 0.18),
          w, h, src: dataUrl,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applySignature = (dataUrl) => {
    setShowSignature(false);
    const dim = pageDims[pageIndex] || { w: 612, h: 792 };
    const img = new window.Image();
    img.onload = () => {
      const maxW = Math.min(dim.w * 0.35, 220);
      const ratio = img.height / img.width;
      const w = maxW;
      const h = maxW * ratio;
      addAnnotation({
        id: uid(), type: 'signature', pageIndex,
        x: (dim.w - w) / 2, y: dim.h * 0.68,
        w, h, src: dataUrl,
      });
      setTool('select');
    };
    img.src = dataUrl;
  };

  const exportPdf = async () => {
    if (!pdfBytesRef.current) return;
    setExporting(true);
    try {
      const { PDFDocument, StandardFonts, rgb, LineCapStyle } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current, { ignoreEncryption: true });
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const courier = await pdfDoc.embedFont(StandardFonts.Courier);
      const fontMap = { helvetica: helv, times, courier };
      const pages = pdfDoc.getPages();
      const imageCache = {};

      for (const a of annotations) {
        const page = pages[a.pageIndex];
        if (!page) continue;
        const pageH = page.getHeight();
        const color = hexToRgb(a.color || '#000000');

        if (a.type === 'remove') {
          page.drawRectangle({ x: a.x, y: pageH - (a.y + a.h), width: a.w, height: a.h, color: rgb(1, 1, 1) });
        } else if (a.type === 'highlight') {
          const c = hexToRgb(a.color || '#facc15');
          page.drawRectangle({ x: a.x, y: pageH - (a.y + a.h), width: a.w, height: a.h, color: rgb(c.r, c.g, c.b), opacity: 0.4 });
        } else if (a.type === 'rect') {
          page.drawRectangle({
            x: a.x, y: pageH - (a.y + a.h), width: a.w, height: a.h,
            borderColor: rgb(color.r, color.g, color.b), borderWidth: a.strokeWidth || 2,
          });
        } else if (a.type === 'draw') {
          for (let i = 1; i < a.points.length; i++) {
            const p0 = a.points[i - 1];
            const p1 = a.points[i];
            page.drawLine({
              start: { x: p0.x, y: pageH - p0.y },
              end: { x: p1.x, y: pageH - p1.y },
              thickness: a.strokeWidth || 2,
              color: rgb(color.r, color.g, color.b),
              lineCap: LineCapStyle.Round,
            });
          }
        } else if (a.type === 'text') {
          const font = fontMap[a.fontFamily] || helv;
          const lines = a.text.split('\n');
          const leading = a.size * 1.2;
          lines.forEach((line, i) => {
            page.drawText(line, {
              x: a.x,
              y: pageH - (a.baseline + i * leading),
              size: a.size,
              font,
              color: rgb(color.r, color.g, color.b),
            });
          });
        } else if (a.type === 'image' || a.type === 'signature') {
          if (!imageCache[a.src]) {
            const bytes = dataUrlToBytes(a.src);
            imageCache[a.src] = a.src.startsWith('data:image/jpeg') || a.src.startsWith('data:image/jpg')
              ? await pdfDoc.embedJpg(bytes)
              : await pdfDoc.embedPng(bytes);
          }
          page.drawImage(imageCache[a.src], { x: a.x, y: pageH - (a.y + a.h), width: a.w, height: a.h });
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.replace(/\.pdf$/i, '') + '-edited.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      window.alert('Could not export the PDF.');
    } finally {
      setExporting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (cmd && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteAnnotation(selectedId);
        return;
      }
      if (cmd || e.altKey) return;
      const map = { v: 'select', t: 'text', d: 'edittext', e: 'remove', h: 'highlight', r: 'rect', p: 'draw', i: 'image', s: 'signature', x: 'eraser' };
      const next = map[e.key.toLowerCase()];
      if (next) {
        if (next === 'image') imageInputRef.current?.click();
        else if (next === 'signature') setShowSignature(true);
        else setTool(next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, undo, redo, deleteAnnotation]);

  useEffect(() => { if (!didMountRef.current) { didMountRef.current = true; } }, []);

  const goToPage = (i) => {
    const el = pageElsRef.current[i];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderObject = (a) => {
    const interactive = tool === 'select' || tool === 'eraser';
    const s = scale;
    const hit = { fill: 'transparent', stroke: 'transparent', style: { pointerEvents: interactive ? 'all' : 'none' } };
    switch (a.type) {
      case 'remove':
        return (
          <>
            <rect x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} fill="#ffffff" style={{ pointerEvents: 'none' }} />
            {interactive && <rect x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} {...hit} />}
          </>
        );
      case 'highlight':
        return (
          <>
            <rect x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} fill={a.color} opacity={0.4} style={{ pointerEvents: 'none' }} />
            {interactive && <rect x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} {...hit} />}
          </>
        );
      case 'rect':
        return (
          <>
            <rect x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} fill="none" stroke={a.color} strokeWidth={a.strokeWidth * s} style={{ pointerEvents: 'none' }} />
            {interactive && <rect x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} {...hit} />}
          </>
        );
      case 'draw':
        return (
          <>
            <path d={pointsToPath(a.points.map(p => ({ x: p.x * s, y: p.y * s })))} fill="none" stroke={a.color} strokeWidth={a.strokeWidth * s} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />
            {interactive && <path d={pointsToPath(a.points.map(p => ({ x: p.x * s, y: p.y * s })))} fill="none" stroke="transparent" strokeWidth={Math.max(a.strokeWidth * s + 14, 16)} strokeLinecap="round" style={{ pointerEvents: 'stroke' }} />}
          </>
        );
      case 'text': {
        const css = FONTS.find(f => f.id === a.fontFamily)?.css || FONTS[0].css;
        return (
          <>
            <text x={a.x * s} y={a.baseline * s} fill={a.color} fontSize={a.size * s} fontFamily={css} style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'pre' }}>
              {(a.text || '').split('\n').map((line, i) => (
                <tspan key={i} x={a.x * s} dy={i === 0 ? 0 : a.size * 1.2 * s}>{line || ' '}</tspan>
              ))}
            </text>
            {interactive && (
              <rect x={(a.x - 2) * s} y={(a.baseline - a.size * 0.9) * s} width={Math.max(...(a.text || ' ').split('\n').map(l => l.length)) * a.size * 0.6 * s} height={((a.text || '').split('\n').length * a.size * 1.2) * s} {...hit} />
            )}
          </>
        );
      }
      case 'image':
      case 'signature':
        return (
          <>
            <image href={a.src} x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} style={{ pointerEvents: 'none' }} />
            {interactive && <rect x={a.x * s} y={a.y * s} width={a.w * s} height={a.h * s} {...hit} />}
          </>
        );
      default:
        return null;
    }
  };

  const selectedAnn = annotations.find(a => a.id === selectedId);

  if (!pdf) {
    if (loading) return <PdfEditorSkeleton />;
    return (
      <div className="h-full flex flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">PDF Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload a PDF to edit its text, add images, signatures and more.</p>
        </header>
        <div
          className={cn(
            'flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); openFile(e.dataTransfer.files?.[0]); }}
        >
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => openFile(e.target.files?.[0])} />
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
              {loading ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <FileText className="w-8 h-8 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-semibold text-foreground">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or choose a file from your device</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Upload className="w-4 h-4" /> Choose PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showFont = tool === 'text' || (tool === 'select' && selectedAnn && selectedAnn.type === 'text');
  const showStroke = tool === 'draw' || tool === 'rect' || (tool === 'select' && selectedAnn && (selectedAnn.type === 'draw' || selectedAnn.type === 'rect'));

  return (
    <div className="h-full flex flex-col gap-5">
      <SignatureModal isOpen={showSignature} onClose={() => setShowSignature(false)} onApply={applySignature} />
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => openFile(e.target.files?.[0])} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight shrink-0">PDF Editor</h1>
          <span className="text-sm text-muted-foreground truncate max-w-[220px] hidden sm:block" title={fileName}>{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" /> Replace
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium transition-opacity disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting…' : 'Download'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden h-[calc(100vh-160px)]">
        {/* Left panel */}
        <div className="w-64 flex flex-col gap-4 shrink-0 overflow-y-auto pr-1 scrollbar-hide">
          <div className="p-4 rounded-2xl bg-secondary border border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.id === 'image') imageInputRef.current?.click();
                    else if (t.id === 'signature') setShowSignature(true);
                    else setTool(t.id);
                  }}
                  title={`${t.label} (${t.key})`}
                  className={cn(
                    'flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-[11px] font-medium transition-colors text-center',
                    tool === t.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-secondary border border-border space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h3>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{showFont ? 'Text color' : 'Color'}</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setAppearance(prev => ({ ...prev, color: c }))}
                    className={cn('w-6 h-6 rounded-full border-2 transition-all', appearance.color === c ? 'border-foreground scale-110' : 'border-border hover:scale-105')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {showFont && (
              <>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Font</p>
                  <div className="flex gap-2">
                    {FONTS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setAppearance(prev => ({ ...prev, fontFamily: f.id }))}
                        className={cn('flex-1 h-8 rounded-md border text-xs transition-colors', appearance.fontFamily === f.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent')}
                        style={{ fontFamily: f.css }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Font size</p>
                  <div className="flex gap-2">
                    {FONT_SIZES.map(s => (
                      <button
                        key={s}
                        onClick={() => setAppearance(prev => ({ ...prev, fontSize: s }))}
                        className={cn('flex-1 h-8 rounded-md border text-xs transition-colors', appearance.fontSize === s ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {showStroke && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Stroke width</p>
                <div className="flex gap-2">
                  {STROKE_WIDTHS.map(w => (
                    <button
                      key={w}
                      onClick={() => setAppearance(prev => ({ ...prev, strokeWidth: w }))}
                      className={cn('flex-1 h-8 rounded-md border flex items-center justify-center transition-colors', appearance.strokeWidth === w ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}
                    >
                      <span className="rounded-full bg-foreground" style={{ width: w * 2 + 2, height: w }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-border text-xs text-muted-foreground leading-relaxed">
              Use <span className="text-foreground font-medium">Detect &amp; edit text</span> to click any text on the page and rewrite it. <span className="text-foreground font-medium">Remove content</span> paints over unwanted areas.
            </div>
          </div>
        </div>

        {/* Canvas card */}
        <div className="flex-1 bg-secondary/50 border border-border rounded-2xl flex flex-col overflow-hidden">
          {/* toolbar */}
          <div className="p-2 border-b border-border flex items-center gap-1 flex-wrap bg-background/20 backdrop-blur-sm">
            <button
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex === 0}
              className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">
              <span className="text-foreground font-medium">{pageIndex + 1}</span> / {numPages}
            </span>
            <button
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex >= numPages - 1}
              className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-border mx-1" />

            <button onClick={undo} disabled={!past.length} className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30" title="Undo (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={!future.length} className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { if (annotations.some(a => a.pageIndex === pageIndex) && window.confirm('Clear edits on this page?')) { pushHistory(); setAnnotations(prev => prev.filter(a => a.pageIndex !== pageIndex)); setSelectedId(null); } }}
              className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
              title="Clear page edits"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="ml-auto flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.max(0.3, s / 1.2))} className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={() => setScale(s => Math.min(3, s * 1.2))} className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const cw = containerRef.current?.clientWidth || 900;
                  const dim = pageDims[pageIndex] || { w: 612 };
                  setScale(Math.min(1.6, Math.max(0.4, (cw - 64) / dim.w)));
                }}
                className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Fit width"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* page area — all pages stacked, scroll like a normal PDF viewer */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto bg-[#1b1b1f] flex flex-col items-center gap-6 p-6"
          >
            {pageDims.map((dim, i) => {
              const pw = dim.w * scale;
              const ph = dim.h * scale;
              const anns = annotations.filter(a => a.pageIndex === i);
              const selAnn = anns.find(a => a.id === selectedId);
              const sb = selAnn ? getAnnBounds(selAnn) : null;
              const items = textItemsMap[i] || [];
              return (
                <div
                  key={i}
                  data-page={i}
                  ref={(el) => { if (el) pageElsRef.current[i] = el; }}
                  className="relative shadow-2xl overflow-hidden shrink-0"
                  style={{ width: pw, height: ph }}
                >
                  <canvas
                    ref={(el) => { if (el) canvasRefs.current[i] = el; }}
                    className="block bg-white"
                    style={{ width: pw, height: ph }}
                  />
                  <svg
                    className="absolute inset-0 touch-none"
                    width={pw}
                    height={ph}
                    style={{ cursor: tool === 'select' ? 'default' : tool === 'eraser' ? 'cell' : tool === 'edittext' ? 'text' : 'crosshair' }}
                    onPointerDown={(e) => handleOverlayPointerDown(e, i)}
                    onPointerMove={handleOverlayPointerMove}
                    onPointerUp={handleOverlayPointerUp}
                  >
                    {anns.map(a => (
                      <g key={a.id} onPointerDown={(e) => handleObjectPointerDown(e, a)} onDoubleClick={(e) => {
                        if (tool === 'select' && a.type === 'text') {
                          e.stopPropagation();
                          openEditor({ id: a.id, pageIndex: a.pageIndex, x: a.x, baseline: a.baseline, value: a.text, size: a.size, color: a.color, fontFamily: a.fontFamily });
                        }
                      }}>
                        {renderObject(a)}
                      </g>
                    ))}
                    {draft && draft.pageIndex === i && <g style={{ pointerEvents: 'none' }}>{renderObject(draft)}</g>}
                    {sb && (
                      <g>
                        <rect
                          x={sb.x * scale - 4}
                          y={sb.y * scale - 4}
                          width={sb.w * scale + 8}
                          height={sb.h * scale + 8}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth={1.5}
                          strokeDasharray="5 3"
                          style={{ pointerEvents: 'none' }}
                        />
                        {(selAnn.type === 'image' || selAnn.type === 'signature' || BOX_TYPES.includes(selAnn.type)) && (
                          <rect
                            x={(sb.x + sb.w) * scale - 5}
                            y={(sb.y + sb.h) * scale - 5}
                            width={10}
                            height={10}
                            fill="hsl(var(--primary))"
                            style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
                            onPointerDown={(e) => startResize(e, selAnn)}
                          />
                        )}
                      </g>
                    )}
                  </svg>

                  {/* text detection overlay */}
                  {tool === 'edittext' && items.map(it => (
                    <button
                      key={it.id}
                      className="absolute z-10 rounded-sm border border-primary/50 bg-primary/10 hover:bg-primary/25 transition-colors"
                      style={{ left: it.x * scale, top: it.top * scale, width: Math.max(it.w * scale, 6), height: Math.max(it.h * scale, 6) }}
                      title={`Edit: ${it.str}`}
                      onClick={() => openEditor({
                        id: null, pageIndex: i, detected: it, x: it.x, baseline: it.baseline, value: it.str,
                        size: it.fontHeight, color: appearance.color, fontFamily: appearance.fontFamily,
                      })}
                    />
                  ))}

                  {/* text editor */}
                  {editing && editing.pageIndex === i && (
                    <textarea
                      autoFocus
                      value={editing.value}
                      onChange={(e) => updateEditor(prev => ({ ...prev, value: e.target.value }))}
                      onFocus={() => { focusedRef.current = true; }}
                      onBlur={() => {
                        // Guard against the browser stealing focus the instant the
                        // textarea mounts (would close the editor before you can type).
                        if (!focusedRef.current) { editingRef.current = null; setEditing(null); return; }
                        commitEditor();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditor(); }
                        else if (e.key === 'Escape') { editingRef.current = null; setEditing(null); }
                      }}
                      className="absolute z-20 bg-white/95 border-2 border-primary outline-none resize-none p-0 px-0.5 m-0 overflow-hidden text-black shadow-lg"
                      style={{
                        left: editing.x * scale,
                        top: (editing.baseline - editing.size * 0.86) * scale,
                        minWidth: Math.max(120, editing.value.length * editing.size * 0.6) * scale,
                        fontSize: editing.size * scale,
                        lineHeight: 1.15,
                        fontFamily: FONTS.find(f => f.id === editing.fontFamily)?.css || FONTS[0].css,
                        color: editing.color,
                        height: Math.max(editing.size * scale * 1.3, 20),
                      }}
                      rows={1}
                    />
                  )}

                  {renderBusy[i] && (
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-2 text-xs bg-secondary/90 border border-border rounded-full px-3 py-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Rendering
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfEditor;
