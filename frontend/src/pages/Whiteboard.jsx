import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MousePointer2, Hand, Pencil, Minus, MoveUpRight, Square, Circle, Type,
  Eraser, Undo2, Redo2, Trash2, Plus, Magnet, ZoomIn, ZoomOut, Maximize,
  Loader2, Check, LayoutGrid
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';
import { WhiteboardSkeleton } from '../components/Skeletons';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
const STROKE_WIDTHS = [2, 3, 5, 8];
const FONT_SIZES = [16, 20, 28, 40];
const LS_KEY = 'bickle_whiteboards';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const perpDist = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return dist(p, a);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
};

// Ramer-Douglas-Peucker simplification
const simplifyRDP = (points, epsilon) => {
  if (points.length < 3) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  let index = -1;
  let maxDist = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon && index !== -1) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
};

// Smooth freehand path using quadratic curves through midpoints
const pointsToPath = (points) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
};

// The brain: turn a wobbly freehand stroke into a clean primitive shape
const recognizeShape = (points) => {
  const pts = simplifyRDP(points, 5);
  if (pts.length < 2) return null;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const diag = Math.hypot(width, height);
  if (diag < 24) return null;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const closed = dist(start, end) < Math.max(diag * 0.2, 22);

  if (closed && width > 4 && height > 4) {
    // How well do the raw points fit a perfect ellipse in the bounding box?
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const a = width / 2;
    const b = height / 2;
    const residual = points.map(p => ((p.x - cx) / a) ** 2 + ((p.y - cy) / b) ** 2);
    const mean = residual.reduce((x, y) => x + y, 0) / residual.length;
    const variance = residual.reduce((s, v) => s + (v - mean) ** 2, 0) / residual.length;
    const cov = Math.sqrt(variance) / mean;
    // Low coefficient of variation => ellipse/circle, otherwise corners => rectangle
    if (cov < 0.15) return { type: 'ellipse', x: minX, y: minY, w: width, h: height };
    return { type: 'rect', x: minX, y: minY, w: width, h: height };
  }

  // Open stroke: is it close enough to a straight line?
  const len = dist(start, end);
  if (len > 24) {
    let maxDev = 0;
    for (const p of pts) {
      const d = perpDist(p, start, end);
      if (d > maxDev) maxDev = d;
    }
    if (maxDev / len < 0.06) {
      return { type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    }
  }
  return { type: 'path' };
};

const getElementBounds = (el) => {
  switch (el.type) {
    case 'path': {
      const xs = el.points.map(p => p.x);
      const ys = el.points.map(p => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case 'line':
    case 'arrow':
      return {
        x: Math.min(el.x1, el.x2),
        y: Math.min(el.y1, el.y2),
        w: Math.abs(el.x2 - el.x1),
        h: Math.abs(el.y2 - el.y1),
      };
    case 'rect':
    case 'ellipse':
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'text':
      return {
        x: el.x,
        y: el.y - el.fontSize,
        w: Math.max((el.text || '').length * el.fontSize * 0.55, 24),
        h: el.fontSize * 1.3,
      };
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
};

const translateElement = (el, dx, dy) => {
  switch (el.type) {
    case 'path':
      return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    case 'line':
    case 'arrow':
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case 'rect':
    case 'ellipse':
    case 'text':
      return { ...el, x: el.x + dx, y: el.y + dy };
    default:
      return el;
  }
};

const constrainLine = (start, cur) => {
  const dx = cur.x - start.x;
  const dy = cur.y - start.y;
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len };
};

const constrainSquare = (start, cur) => {
  const size = Math.max(Math.abs(cur.x - start.x), Math.abs(cur.y - start.y));
  return {
    x: start.x + (cur.x < start.x ? -size : size),
    y: start.y + (cur.y < start.y ? -size : size),
  };
};

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Pan', key: 'H' },
  { id: 'pen', icon: Pencil, label: 'Smart Pen', key: 'P' },
  { id: 'line', icon: Minus, label: 'Line', key: 'L' },
  { id: 'arrow', icon: MoveUpRight, label: 'Arrow', key: 'A' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: Circle, label: 'Circle', key: 'C' },
  { id: 'text', icon: Type, label: 'Text', key: 'T' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
];

const Whiteboard = () => {
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [elements, setElements] = useState([]);
  const [title, setTitle] = useState('Untitled Board');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  const [tool, setTool] = useState('pen');
  const [smartShapes, setSmartShapes] = useState(true);
  const [appearance, setAppearance] = useState({
    stroke: '#ffffff',
    fill: '#8b5cf6',
    fillEnabled: false,
    strokeWidth: 3,
    fontSize: 20,
  });

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [textEdit, setTextEdit] = useState(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);

  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const offlineRef = useRef(false);
  const boardsRef = useRef([]);
  const drawRef = useRef({ active: false });
  const dragRef = useRef({ active: false });
  const panRef = useRef({ active: false });
  const spaceRef = useRef(false);
  const textEditRef = useRef(null);
  const skipSaveRef = useRef(false);
  const saveTimer = useRef(null);
  const didFetchRef = useRef(false);

  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  const loadLocalBoards = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const saveLocalBoards = (list) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    const fetchBoards = async () => {
      try {
        const res = await axios.get('/whiteboards');
        let data = res.data;
        if (!data.length) {
          const created = await axios.post('/whiteboards', { title: 'My First Board', elements: [] });
          data = [created.data];
        }
        setBoards(data);
        setActiveBoardId(data[0]._id);
      } catch (err) {
        offlineRef.current = true;
        setOffline(true);
        let local = loadLocalBoards();
        if (!local.length) {
          local = [{ _id: uid(), title: 'My First Board', elements: [], lastEdited: new Date().toISOString() }];
          saveLocalBoards(local);
        }
        setBoards(local);
        setActiveBoardId(local[0]._id);
      } finally {
        setLoading(false);
      }
    };
    fetchBoards();
  }, []);

  // Load the selected board into the working canvas
  useEffect(() => {
    if (!activeBoardId) return;
    const board = boardsRef.current.find(b => b._id === activeBoardId);
    if (!board) return;
    skipSaveRef.current = true;
    setElements(board.elements || []);
    setTitle(board.title || 'Untitled Board');
    setSelectedId(null);
    setPast([]);
    setFuture([]);
    setDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId]);

  const saveBoard = useCallback(async (id, nextTitle, nextElements) => {
    const updated = { title: nextTitle, elements: nextElements, lastEdited: new Date().toISOString() };
    const next = boardsRef.current.map(b => (b._id === id ? { ...b, ...updated } : b));
    setBoards(next);
    if (offlineRef.current) {
      saveLocalBoards(next);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1200);
      return;
    }
    try {
      await axios.put(`/whiteboards/${id}`, { title: nextTitle, elements: nextElements });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('idle');
    }
  }, []);

  // Debounced autosave on any change
  useEffect(() => {
    if (!activeBoardId) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveBoard(activeBoardId, title, elements), 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [elements, title, activeBoardId, saveBoard]);

  const pushHistory = useCallback(() => {
    setPast(prev => [...prev.slice(-49), elements]);
    setFuture([]);
  }, [elements]);

  const undo = useCallback(() => {
    if (!past.length) return;
    const prior = past[past.length - 1];
    setFuture(f => [elements, ...f]);
    setPast(p => p.slice(0, -1));
    setElements(prior);
    setSelectedId(null);
  }, [past, elements]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setPast(p => [...p, elements]);
    setFuture(f => f.slice(1));
    setElements(next);
    setSelectedId(null);
  }, [future, elements]);

  const createBoard = async () => {
    const payload = { title: 'Untitled Board', elements: [] };
    if (offlineRef.current) {
      const board = { _id: uid(), ...payload, lastEdited: new Date().toISOString() };
      const next = [board, ...boardsRef.current];
      setBoards(next);
      saveLocalBoards(next);
      setActiveBoardId(board._id);
    } else {
      try {
        const res = await axios.post('/whiteboards', payload);
        setBoards(prev => [res.data, ...prev]);
        setActiveBoardId(res.data._id);
      } catch (err) {
        console.error('Failed to create board:', err);
      }
    }
  };

  const deleteBoard = async (id) => {
    if (boardsRef.current.length <= 1) {
      window.alert('You need at least one whiteboard.');
      return;
    }
    if (!window.confirm('Delete this whiteboard?')) return;
    const remaining = boardsRef.current.filter(b => b._id !== id);
    if (!offlineRef.current) {
      try {
        await axios.delete(`/whiteboards/${id}`);
      } catch (err) {
        console.error('Failed to delete board:', err);
        return;
      }
    } else {
      saveLocalBoards(remaining);
    }
    setBoards(remaining);
    if (activeBoardId === id) setActiveBoardId(remaining[0]._id);
  };

  const screenToWorld = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  }, [view]);

  const makeDraft = useCallback((mode, start, cur, shift) => {
    if (mode === 'pen') {
      return { id: 'draft', type: 'path', points: [start, cur], stroke: appearance.stroke, strokeWidth: appearance.strokeWidth, fill: 'none' };
    }
    if (mode === 'line' || mode === 'arrow') {
      const end = shift ? constrainLine(start, cur) : cur;
      return { id: 'draft', type: mode, x1: start.x, y1: start.y, x2: end.x, y2: end.y, stroke: appearance.stroke, strokeWidth: appearance.strokeWidth, fill: 'none' };
    }
    const end = shift ? constrainSquare(start, cur) : cur;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
      id: 'draft',
      type: mode,
      x,
      y,
      w: Math.abs(end.x - start.x),
      h: Math.abs(end.y - start.y),
      stroke: appearance.stroke,
      strokeWidth: appearance.strokeWidth,
      fill: appearance.fillEnabled ? appearance.fill : 'none',
    };
  }, [appearance]);

  const commitText = useCallback(() => {
    const t = textEditRef.current;
    if (!t) return;
    textEditRef.current = null;
    setTextEdit(null);
    if (t.value.trim()) {
      pushHistory();
      if (t.id) {
        setElements(prev => prev.map(el => (el.id === t.id ? { ...el, text: t.value, x: t.x, y: t.y, fontSize: t.fontSize, stroke: t.color } : el)));
      } else {
        setElements(prev => [...prev, { id: uid(), type: 'text', x: t.x, y: t.y, text: t.value, fontSize: t.fontSize, stroke: t.color }]);
      }
    } else if (t.id) {
      pushHistory();
      setElements(prev => prev.filter(el => el.id !== t.id));
    }
  }, [pushHistory]);

  const openTextEditor = (t) => {
    textEditRef.current = t;
    setTextEdit(t);
  };

  const updateTextEditor = (updater) => {
    const next = updater(textEditRef.current);
    textEditRef.current = next;
    setTextEdit(next);
  };

  const finalizeDraw = (shift) => {
    const d = drawRef.current;
    setDraft(null);
    if (!d || !d.active) return;
    const pts = d.points;
    if (!pts || pts.length < 2) return;
    const last = pts[pts.length - 1];
    let el = null;

    if (d.mode === 'pen') {
      const rec = smartShapes ? recognizeShape(pts) : { type: 'path' };
      if (rec.type === 'line') {
        el = { id: uid(), type: 'line', x1: rec.x1, y1: rec.y1, x2: rec.x2, y2: rec.y2, stroke: appearance.stroke, strokeWidth: appearance.strokeWidth };
      } else if (rec.type === 'rect') {
        el = { id: uid(), type: 'rect', x: rec.x, y: rec.y, w: rec.w, h: rec.h, stroke: appearance.stroke, strokeWidth: appearance.strokeWidth, fill: appearance.fillEnabled ? appearance.fill : 'none' };
      } else if (rec.type === 'ellipse') {
        el = { id: uid(), type: 'ellipse', x: rec.x, y: rec.y, w: rec.w, h: rec.h, stroke: appearance.stroke, strokeWidth: appearance.strokeWidth, fill: appearance.fillEnabled ? appearance.fill : 'none' };
      } else {
        el = { id: uid(), type: 'path', points: simplifyRDP(pts, 1.5), stroke: appearance.stroke, strokeWidth: appearance.strokeWidth, fill: 'none' };
      }
    } else {
      const shape = makeDraft(d.mode, d.start, last, shift);
      if (d.mode === 'rect' || d.mode === 'ellipse') {
        if (shape.w < 3 || shape.h < 3) return;
      } else if (Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) < 4) {
        return;
      }
      el = { ...shape, id: uid() };
    }
    if (!el) return;
    pushHistory();
    setElements(prev => [...prev, el]);
  };

  const handleCanvasPointerDown = (e) => {
    if (textEditRef.current) {
      commitText();
      return;
    }
    const wantPan = tool === 'hand' || e.button === 1 || (e.button === 0 && spaceRef.current);
    if (wantPan) {
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y };
      setPanning(true);
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const world = screenToWorld(e.clientX, e.clientY);

    if (tool === 'select') {
      setSelectedId(null);
      return;
    }
    if (tool === 'eraser') return;
    if (tool === 'text') {
      openTextEditor({ id: null, x: world.x, y: world.y, value: '', fontSize: appearance.fontSize, color: appearance.stroke });
      return;
    }

    drawRef.current = { active: true, mode: tool, points: [world], start: world, last: world };
    setDraft(makeDraft(tool, world, world, e.shiftKey));
    svgRef.current.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e) => {
    if (panRef.current.active) {
      const p = panRef.current;
      setView(v => ({ ...v, x: p.originX + (e.clientX - p.startX), y: p.originY + (e.clientY - p.startY) }));
      return;
    }
    if (dragRef.current.active) {
      const d = dragRef.current;
      const world = screenToWorld(e.clientX, e.clientY);
      const dx = world.x - d.lastWorld.x;
      const dy = world.y - d.lastWorld.y;
      d.lastWorld = world;
      if (!d.moved) {
        d.moved = true;
        pushHistory();
      }
      setElements(prev => prev.map(el => (el.id === d.id ? translateElement(el, dx, dy) : el)));
      return;
    }
    const d = drawRef.current;
    if (!d.active) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (d.mode === 'pen') {
      const lastP = d.points[d.points.length - 1];
      if (Math.hypot(world.x - lastP.x, world.y - lastP.y) > 2 / view.scale) {
        d.points.push(world);
        setDraft({ id: 'draft', type: 'path', points: d.points.slice(), stroke: appearance.stroke, strokeWidth: appearance.strokeWidth, fill: 'none' });
      }
    } else {
      d.last = world;
      setDraft(makeDraft(d.mode, d.start, world, e.shiftKey));
    }
  };

  const handleCanvasPointerUp = (e) => {
    if (panRef.current.active) {
      panRef.current.active = false;
      setPanning(false);
      return;
    }
    if (dragRef.current.active) {
      dragRef.current.active = false;
      return;
    }
    if (drawRef.current.active) {
      finalizeDraw(e.shiftKey);
    }
    drawRef.current = { active: false };
  };

  const handleElementPointerDown = (e, el) => {
    if (tool === 'select') {
      e.stopPropagation();
      if (textEditRef.current) {
        commitText();
        return;
      }
      setSelectedId(el.id);
      dragRef.current = { active: true, id: el.id, moved: false, lastWorld: screenToWorld(e.clientX, e.clientY) };
      svgRef.current.setPointerCapture(e.pointerId);
    } else if (tool === 'eraser') {
      e.stopPropagation();
      pushHistory();
      setElements(prev => prev.filter(x => x.id !== el.id));
    }
  };

  const handleElementDoubleClick = (e, el) => {
    if (tool === 'select' && el.type === 'text') {
      e.stopPropagation();
      openTextEditor({ id: el.id, x: el.x, y: el.y, value: el.text, fontSize: el.fontSize, color: el.stroke });
    }
  };

  // Zoom / pan with the wheel
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = svg.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        setView(v => {
          const factor = Math.exp(-e.deltaY * 0.0015);
          const scale = Math.min(5, Math.max(0.15, v.scale * factor));
          const wx = (mx - v.x) / v.scale;
          const wy = (my - v.y) / v.scale;
          return { scale, x: mx - wx * scale, y: my - wy * scale };
        });
      } else {
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [loading]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (cmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          pushHistory();
          setElements(prev => prev.filter(x => x.id !== selectedId));
          setSelectedId(null);
        }
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        spaceRef.current = true;
        setSpaceDown(true);
      }
      if (cmd || e.altKey) return;
      const map = { v: 'select', h: 'hand', p: 'pen', l: 'line', a: 'arrow', r: 'rect', c: 'ellipse', t: 'text', e: 'eraser' };
      const nextTool = map[e.key.toLowerCase()];
      if (nextTool) setTool(nextTool);
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [selectedId, undo, redo, pushHistory]);

  useEffect(() => {
    if (tool !== 'select') setSelectedId(null);
  }, [tool]);

  const zoomBy = (factor) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    setView(v => {
      const scale = Math.min(5, Math.max(0.15, v.scale * factor));
      const wx = (mx - v.x) / v.scale;
      const wy = (my - v.y) / v.scale;
      return { scale, x: mx - wx * scale, y: my - wy * scale };
    });
  };

  const renderShape = (el) => {
    const interactive = tool === 'select' || tool === 'eraser';
    const stroke = el.stroke;
    const sw = el.strokeWidth;
    const common = {
      stroke,
      strokeWidth: sw,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      fill: el.fill || 'none',
    };
    const hit = { fill: 'none', stroke: 'transparent', strokeWidth: Math.max(sw + 14, 18), strokeLinecap: 'round' };

    switch (el.type) {
      case 'path': {
        const d = pointsToPath(el.points);
        return (
          <>
            <path d={d} {...common} style={{ pointerEvents: 'none' }} />
            {interactive && <path d={d} {...hit} style={{ pointerEvents: 'stroke' }} />}
          </>
        );
      }
      case 'line':
        return (
          <>
            <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...common} style={{ pointerEvents: 'none' }} />
            {interactive && <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...hit} style={{ pointerEvents: 'stroke' }} />}
          </>
        );
      case 'arrow': {
        const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const hl = 10 + sw * 2;
        const p1 = { x: el.x2 - hl * Math.cos(angle - 0.42), y: el.y2 - hl * Math.sin(angle - 0.42) };
        const p2 = { x: el.x2 - hl * Math.cos(angle + 0.42), y: el.y2 - hl * Math.sin(angle + 0.42) };
        return (
          <>
            <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...common} style={{ pointerEvents: 'none' }} />
            <polygon points={`${el.x2},${el.y2} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={stroke} style={{ pointerEvents: 'none' }} />
            {interactive && <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...hit} style={{ pointerEvents: 'stroke' }} />}
          </>
        );
      }
      case 'rect':
        return (
          <>
            <rect x={el.x} y={el.y} width={el.w} height={el.h} {...common} style={{ pointerEvents: 'none' }} />
            {interactive && (
              <rect x={el.x} y={el.y} width={el.w} height={el.h} fill="transparent" stroke="transparent" strokeWidth={Math.max(sw + 14, 18)} style={{ pointerEvents: 'all' }} />
            )}
          </>
        );
      case 'ellipse':
        return (
          <>
            <ellipse
              cx={el.x + el.w / 2}
              cy={el.y + el.h / 2}
              rx={el.w / 2}
              ry={el.h / 2}
              {...common}
              style={{ pointerEvents: 'none' }}
            />
            {interactive && (
              <ellipse
                cx={el.x + el.w / 2}
                cy={el.y + el.h / 2}
                rx={el.w / 2}
                ry={el.h / 2}
                fill="transparent"
                stroke="transparent"
                strokeWidth={Math.max(sw + 14, 18)}
                style={{ pointerEvents: 'all' }}
              />
            )}
          </>
        );
      case 'text':
        return (
          <>
            <text
              x={el.x}
              y={el.y}
              fill={stroke}
              fontSize={el.fontSize}
              fontFamily="Inter, system-ui, sans-serif"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {(el.text || '').split('\n').map((line, i) => (
                <tspan key={i} x={el.x} dy={i === 0 ? 0 : el.fontSize * 1.25}>{line || ' '}</tspan>
              ))}
            </text>
            {interactive && (
              <rect
                x={el.x - 4}
                y={el.y - el.fontSize}
                width={Math.max((el.text || '').length * el.fontSize * 0.6, 24)}
                height={el.fontSize * 1.3}
                fill="transparent"
                style={{ pointerEvents: 'all' }}
              />
            )}
          </>
        );
      default:
        return null;
    }
  };

  if (loading) return <WhiteboardSkeleton />;

  const cursor = panning || tool === 'hand' || spaceDown
    ? (panning ? 'grabbing' : 'grab')
    : tool === 'select'
      ? 'default'
      : tool === 'text'
        ? 'text'
        : tool === 'eraser'
          ? 'cell'
          : 'crosshair';

  const selEl = elements.find(el => el.id === selectedId);
  const selBounds = selEl ? getElementBounds(selEl) : null;
  const showFill = tool === 'rect' || tool === 'ellipse' || (tool === 'select' && selEl && (selEl.type === 'rect' || selEl.type === 'ellipse'));
  const showFont = tool === 'text' || (tool === 'select' && selEl && selEl.type === 'text');

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight shrink-0">Whiteboard</h1>
          {offline && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Backend unavailable — boards are stored in this browser">
              Local only
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground w-24 text-right hidden sm:block">
            {saveStatus === 'saving' ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>
            ) : saveStatus === 'saved' ? (
              <span className="inline-flex items-center gap-1.5 text-primary"><Check className="w-3.5 h-3.5" /> Saved</span>
            ) : (
              'Autosave on'
            )}
          </div>
          <button
            onClick={createBoard}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> New Board
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden h-[calc(100vh-160px)]">
        {/* Left panel */}
        <div className="w-64 flex flex-col gap-4 shrink-0 overflow-y-auto pr-1 scrollbar-hide">
          <div className="p-4 rounded-2xl bg-secondary border border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <LayoutGrid className="w-3 h-3" /> Boards
            </h3>
            <div className="space-y-1">
              {boards.map(board => (
                <div
                  key={board._id}
                  onClick={() => setActiveBoardId(board._id)}
                  className={cn(
                    'group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer',
                    activeBoardId === board._id
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <span className="flex-1 truncate">{board.title || 'Untitled Board'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteBoard(board._id); }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-colors hover:text-red-500"
                    title="Delete board"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-secondary border border-border space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h3>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Stroke color</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setAppearance(prev => ({ ...prev, stroke: color }))}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-all',
                      appearance.stroke === color ? 'border-foreground scale-110' : 'border-border hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {showFill && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Fill color</p>
                  <button
                    onClick={() => setAppearance(prev => ({ ...prev, fillEnabled: !prev.fillEnabled }))}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                      appearance.fillEnabled ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                    )}
                  >
                    {appearance.fillEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                <div className={cn('flex flex-wrap gap-2', !appearance.fillEnabled && 'opacity-40 pointer-events-none')}>
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setAppearance(prev => ({ ...prev, fill: color, fillEnabled: true }))}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-all',
                        appearance.fill === color ? 'border-foreground scale-110' : 'border-border hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Stroke width</p>
              <div className="flex gap-2">
                {STROKE_WIDTHS.map(w => (
                  <button
                    key={w}
                    onClick={() => setAppearance(prev => ({ ...prev, strokeWidth: w }))}
                    className={cn(
                      'flex-1 h-8 rounded-md border flex items-center justify-center transition-colors',
                      appearance.strokeWidth === w ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                    )}
                    title={`${w}px`}
                  >
                    <span className="rounded-full bg-foreground" style={{ width: w * 2 + 2, height: w }} />
                  </button>
                ))}
              </div>
            </div>

            {showFont && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Font size</p>
                <div className="flex gap-2">
                  {FONT_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => setAppearance(prev => ({ ...prev, fontSize: s }))}
                      className={cn(
                        'flex-1 h-8 rounded-md border text-xs transition-colors',
                        appearance.fontSize === s ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-border">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Board name</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Board"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Canvas card */}
        <div className="flex-1 bg-secondary/50 border border-border rounded-2xl flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="p-2 border-b border-border flex items-center gap-1 flex-wrap bg-background/20 backdrop-blur-sm">
            {TOOLS.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={`${t.label} (${t.key})`}
                className={cn(
                  'p-2 rounded-md transition-colors',
                  tool === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <t.icon className="w-4 h-4" />
              </button>
            ))}

            <div className="w-px h-6 bg-border mx-1" />

            <button
              onClick={undo}
              disabled={!past.length}
              title="Undo (Ctrl+Z)"
              className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!future.length}
              title="Redo (Ctrl+Shift+Z)"
              className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (!elements.length) return;
                if (window.confirm('Clear this board?')) {
                  pushHistory();
                  setElements([]);
                  setSelectedId(null);
                }
              }}
              title="Clear board"
              className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-border mx-1" />

            <button
              onClick={() => setSmartShapes(s => !s)}
              title="Snap freehand strokes to clean shapes"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                smartShapes ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Magnet className="w-4 h-4" /> Snap
            </button>

            <div className="ml-auto flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-center">{Math.round(view.scale * 100)}%</span>
              <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out" className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={() => zoomBy(1.2)} title="Zoom in" className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setView({ x: 0, y: 0, scale: 1 })} title="Reset view" className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div ref={containerRef} className="relative flex-1 overflow-hidden bg-background">
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full touch-none select-none"
              style={{ cursor }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              <defs>
                <pattern id="wb-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.2" fill="#ffffff" opacity="0.09" />
                </pattern>
              </defs>
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                <rect x={-6000} y={-6000} width={12000} height={12000} fill="url(#wb-dots)" style={{ pointerEvents: 'none' }} />
                {elements.map(el => (
                  <g
                    key={el.id}
                    onPointerDown={(e) => handleElementPointerDown(e, el)}
                    onDoubleClick={(e) => handleElementDoubleClick(e, el)}
                  >
                    {renderShape(el)}
                  </g>
                ))}
                {draft && <g style={{ pointerEvents: 'none' }}>{renderShape(draft)}</g>}
                {selBounds && (
                  <rect
                    x={selBounds.x - 6}
                    y={selBounds.y - 6}
                    width={selBounds.w + 12}
                    height={selBounds.h + 12}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5 / view.scale}
                    strokeDasharray={`${6 / view.scale} ${4 / view.scale}`}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            </svg>

            {textEdit && (
              <textarea
                autoFocus
                value={textEdit.value}
                onChange={(e) => updateTextEditor(prev => ({ ...prev, value: e.target.value }))}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitText();
                  } else if (e.key === 'Escape') {
                    textEditRef.current = null;
                    setTextEdit(null);
                  }
                }}
                placeholder="Type…"
                rows={1}
                className="absolute bg-transparent border border-primary/60 rounded-sm outline-none resize-none p-0 m-0 overflow-hidden placeholder:text-muted-foreground/50"
                style={{
                  left: view.x + textEdit.x * view.scale,
                  top: view.y + (textEdit.y - textEdit.fontSize) * view.scale,
                  fontSize: textEdit.fontSize * view.scale,
                  lineHeight: 1.25,
                  color: textEdit.color,
                  minWidth: Math.max(120, 6 * textEdit.fontSize) * view.scale,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  caretColor: textEdit.color,
                }}
              />
            )}

            {/* Empty hint */}
            {!elements.length && !draft && !textEdit && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/60 gap-2">
                <Pencil className="w-10 h-10 opacity-30" />
                <p className="text-sm">Draw a wobbly line and watch it snap straight — try a circle or square too</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
