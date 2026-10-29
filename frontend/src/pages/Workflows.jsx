import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Workflow, Folder, FolderOpen, FolderPlus, Plus, Play, Pencil, Trash2, Copy,
  ChevronUp, ChevronDown, Check, X, GitBranch, AlertTriangle, StickyNote,
  ListChecks, RotateCcw, Clock, Flag, ArrowRight, History, Sparkles, Circle,
  CheckCircle2, SkipForward, Link2,
} from 'lucide-react';
import { useWorkflows, makeId, FOLDER_COLORS } from '../hooks/useWorkflows';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const STEP_META = {
  task: { label: 'Task', icon: ListChecks, color: 'text-emerald-400', chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  note: { label: 'Note', icon: StickyNote, color: 'text-sky-400', chip: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  decision: { label: 'If / Else', icon: GitBranch, color: 'text-amber-400', chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  exception: { label: 'Exception', icon: AlertTriangle, color: 'text-rose-400', chip: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

const newStep = (type) => {
  const base = { id: makeId(), type, title: '', detail: '', optional: false };
  if (type === 'task') {
    return {
      ...base,
      title: 'New task',
      exception: { enabled: false, title: '', detail: '', goto: 'end' },
    };
  }
  if (type === 'note') return { ...base, title: 'New note' };
  if (type === 'decision') {
    return {
      ...base,
      title: 'New decision',
      options: [
        { id: makeId(), label: 'Yes', goto: 'next' },
        { id: makeId(), label: 'No', goto: 'next' },
      ],
    };
  }
  return { ...base, title: 'New exception', exception: true };
};

const createExampleWorkflow = (folderId) => ({
  id: makeId(),
  folderId,
  title: 'Morning Startup',
  description: 'Sample workflow showing steps, an if/else decision and an exception handler.',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  steps: [
    {
      id: 'ex-coffee',
      type: 'task',
      title: 'Make coffee',
      detail: 'Grind beans, brew, pour.',
      optional: false,
      exception: {
        enabled: true,
        title: 'Machine broken?',
        detail: 'Fall back to ordering coffee from the cafe app.',
        goto: 'ex-order',
      },
    },
    {
      id: 'ex-rain',
      type: 'decision',
      title: 'Heading out — is it raining?',
      detail: 'Pick the branch that matches reality.',
      optional: false,
      options: [
        { id: 'ex-o1', label: 'Yes ☔', goto: 'ex-umbrella' },
        { id: 'ex-o2', label: 'No ☀️', goto: 'ex-walk' },
      ],
    },
    {
      id: 'ex-umbrella',
      type: 'task',
      title: 'Grab the umbrella',
      detail: 'It lives by the door.',
      optional: true,
      next: 'ex-order',
      exception: { enabled: false, title: '', detail: '', goto: 'end' },
    },
    {
      id: 'ex-walk',
      type: 'note',
      title: 'Enjoy the walk',
      detail: 'No headphones for the first ten minutes.',
      optional: false,
      next: 'ex-order',
    },
    {
      id: 'ex-order',
      type: 'task',
      title: 'Order coffee online',
      detail: 'Usual order, deliver to the desk.',
      optional: false,
      next: 'ex-cal',
      exception: { enabled: false, title: '', detail: '', goto: 'end' },
    },
    { id: 'ex-cal', type: 'task', title: 'Check the calendar', detail: 'Skim today’s meetings.', optional: false, exception: { enabled: false, title: '', detail: '', goto: 'end' } },
  ],
});

const nextStepId = (workflow, stepId) => {
  const idx = workflow.steps.findIndex((s) => s.id === stepId);
  if (idx === -1 || idx === workflow.steps.length - 1) return null;
  return workflow.steps[idx + 1].id;
};

const resolveGoto = (workflow, goto, currentStepId) => {
  if (!goto || goto === 'next') return nextStepId(workflow, currentStepId);
  if (goto === 'end') return null;
  return workflow.steps.some((s) => s.id === goto) ? goto : null;
};

// Where a step goes after it is completed.
// Explicit `step.next` always wins. Without one: a step reached in the main
// (linear) flow continues to the next step in the list, while a step reached
// via a branch (decision choice or exception jump) ends the run — so taking
// the "Yes" branch never falls through into the "No" branch's steps.
const continuationFor = (workflow, step, viaBranch) => {
  if (step.next === 'next') return nextStepId(workflow, step.id);
  if (step.next === 'end') return null;
  if (step.next) {
    return workflow.steps.some((s) => s.id === step.next) ? step.next : null;
  }
  return viaBranch ? null : nextStepId(workflow, step.id);
};

const isBranchTarget = (workflow, stepId) =>
  workflow.steps.some(
    (s) =>
      (s.options || []).some((o) => o.goto === stepId) ||
      (s.exception && typeof s.exception === 'object' && s.exception.enabled && s.exception.goto === stepId),
  );

const formatDuration = (ms) => {
  if (ms == null) return '—';
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
};

const formatWhen = (ts) => {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
};

const StepIcon = ({ type, className }) => {
  const Meta = STEP_META[type] || STEP_META.task;
  return <Meta.icon className={cn('w-4 h-4', className || Meta.color)} />;
};

const GotoSelect = ({ value, onChange, steps, currentStepId, excludeSelf = true }) => (
  <select
    value={value || 'next'}
    onChange={(e) => onChange(e.target.value)}
    className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
  >
    <option value="next">→ Next step</option>
    <option value="end">⚑ End workflow</option>
    {steps
      .filter((s) => !excludeSelf || s.id !== currentStepId)
      .map((s, i) => (
        <option key={s.id} value={s.id}>
          ↳ Step {steps.findIndex((x) => x.id === s.id) + 1}: {s.title || 'Untitled'}
        </option>
      ))}
  </select>
);

const ContinuationSelect = ({ value, onChange, steps, currentStepId, isBranchTargetStep }) => (
  <select
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value || undefined)}
    className="bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
  >
    <option value="">
      {isBranchTargetStep ? 'Auto — end the run here' : 'Auto — next step'}
    </option>
    <option value="next">→ Next step</option>
    <option value="end">⚑ End workflow</option>
    {steps
      .filter((s) => s.id !== currentStepId)
      .map((s) => (
        <option key={s.id} value={s.id}>
          ↳ Step {steps.findIndex((x) => x.id === s.id) + 1}: {s.title || 'Untitled'}
        </option>
      ))}
  </select>
);

const Workflows = () => {
  const [state, update] = useWorkflows();
  const { folders, workflows, runs } = state;

  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [runOpen, setRunOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderDraft, setFolderDraft] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [run, setRun] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const addStepRef = useRef(null);

  const folder = folders.find((f) => f.id === state.selectedFolderId) || folders[0];

  const folderWorkflows = useMemo(() => {
    const list = workflows.filter((w) => w.folderId === folder?.id);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (w) =>
            w.title.toLowerCase().includes(q) ||
            (w.description || '').toLowerCase().includes(q) ||
            w.steps.some((s) => (s.title || '').toLowerCase().includes(q)),
        )
      : list;
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [workflows, folder, query]);

  const selected = workflows.find((w) => w.id === selectedWorkflowId) || null;

  useEffect(() => {
    if (selected && folder && selected.folderId !== folder.id) {
      setSelectedWorkflowId(null);
      setRunOpen(false);
      setRun(null);
    }
  }, [folder, selected]);

  useEffect(() => {
    if (!run || run.finishedAt) return undefined;
    const timer = setInterval(() => setElapsed(Date.now() - run.startedAt), 1000);
    return () => clearInterval(timer);
  }, [run]);

  useEffect(() => {
    const onClick = (e) => {
      if (addStepOpen && addStepRef.current && !addStepRef.current.contains(e.target)) {
        setAddStepOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [addStepOpen]);

  const mutateWorkflow = (id, fn) =>
    update((prev) => ({
      ...prev,
      workflows: prev.workflows.map((w) =>
        w.id === id ? { ...fn(w), updatedAt: Date.now() } : w,
      ),
    }));

  const handleAddFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folderObj = { id: makeId(), name, color: newFolderColor };
    update((prev) => ({
      ...prev,
      folders: [...prev.folders, folderObj],
      selectedFolderId: folderObj.id,
    }));
    setNewFolderName('');
    setAddingFolder(false);
    setSelectedWorkflowId(null);
    setRun(null);
  };

  const handleRenameFolder = (id) => {
    const name = folderDraft.trim();
    if (name) {
      update((prev) => ({
        ...prev,
        folders: prev.folders.map((f) => (f.id === id ? { ...f, name } : f)),
      }));
    }
    setEditingFolderId(null);
  };

  const handleDeleteFolder = (id) => {
    const target = folders.find((f) => f.id === id);
    if (!target) return;
    const count = workflows.filter((w) => w.folderId === id).length;
    const ok = window.confirm(
      count
        ? `Delete folder "${target.name}" and its ${count} workflow${count > 1 ? 's' : ''}? This cannot be undone.`
        : `Delete folder "${target.name}"?`,
    );
    if (!ok) return;
    if (folders.length <= 1) {
      window.alert('You need at least one folder.');
      return;
    }
    const workflowIds = new Set(workflows.filter((w) => w.folderId === id).map((w) => w.id));
    update((prev) => {
      const nextFolders = prev.folders.filter((f) => f.id !== id);
      return {
        ...prev,
        folders: nextFolders,
        workflows: prev.workflows.filter((w) => w.folderId !== id),
        runs: prev.runs.filter((r) => !workflowIds.has(r.workflowId)),
        selectedFolderId:
          prev.selectedFolderId === id ? nextFolders[0]?.id ?? null : prev.selectedFolderId,
      };
    });
    if (workflowIds.has(selectedWorkflowId)) {
      setSelectedWorkflowId(null);
      setRunOpen(false);
      setRun(null);
    }
  };

  const handleCreateWorkflow = () => {
    if (!folder) return;
    const wf = {
      id: makeId(),
      folderId: folder.id,
      title: 'Untitled workflow',
      description: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      steps: [newStep('task')],
    };
    update((prev) => ({ ...prev, workflows: [...prev.workflows, wf] }));
    setSelectedWorkflowId(wf.id);
    setRun(null);
  };

  const handleInsertExample = () => {
    if (!folder) return;
    const wf = createExampleWorkflow(folder.id);
    update((prev) => ({ ...prev, workflows: [...prev.workflows, wf] }));
    setSelectedWorkflowId(wf.id);
    setRun(null);
  };

  const handleDeleteWorkflow = (id) => {
    if (!window.confirm('Delete this workflow and its run history?')) return;
    update((prev) => ({
      ...prev,
      workflows: prev.workflows.filter((w) => w.id !== id),
      runs: prev.runs.filter((r) => r.workflowId !== id),
    }));
    if (selectedWorkflowId === id) {
      setSelectedWorkflowId(null);
      setRunOpen(false);
      setRun(null);
    }
  };

  const handleDuplicateWorkflow = (wf) => {
    const idMap = new Map(wf.steps.map((s) => [s.id, makeId()]));
    const remap = (v) => (v && idMap.has(v) ? idMap.get(v) : v);
    const clone = {
      ...JSON.parse(JSON.stringify(wf)),
      id: makeId(),
      title: `${wf.title} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      steps: wf.steps.map((s) => ({
        ...JSON.parse(JSON.stringify(s)),
        id: idMap.get(s.id),
        ...(s.next !== undefined ? { next: remap(s.next) } : { next: undefined }),
        ...(s.options
          ? { options: s.options.map((o) => ({ ...o, id: makeId(), goto: remap(o.goto) })) }
          : {}),
        ...(s.exception && typeof s.exception === 'object'
          ? { exception: { ...s.exception, goto: remap(s.exception.goto) } }
          : {}),
      })),
    };
    update((prev) => ({ ...prev, workflows: [...prev.workflows, clone] }));
    setSelectedWorkflowId(clone.id);
    setRun(null);
  };

  const handleMoveWorkflow = (id, targetFolderId) => {
    mutateWorkflow(id, (w) => ({ ...w, folderId: targetFolderId }));
  };

  const handleAddStep = (type) => {
    if (!selected) return;
    const step = newStep(type);
    mutateWorkflow(selected.id, (w) => ({ ...w, steps: [...w.steps, step] }));
    setAddStepOpen(false);
  };

  const handleUpdateStep = (stepId, patch) => {
    if (!selected) return;
    mutateWorkflow(selected.id, (w) => ({
      ...w,
      steps: w.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    }));
  };

  const handleDeleteStep = (stepId) => {
    if (!selected) return;
    mutateWorkflow(selected.id, (w) => {
      const steps = w.steps
        .filter((s) => s.id !== stepId)
        .map((s) => {
          const sanitize = (goto) => (goto === stepId ? 'next' : goto);
          const nextRef = s.next === stepId ? { next: undefined } : {};
          return {
            ...s,
            ...nextRef,
            ...(s.options
              ? { options: s.options.map((o) => ({ ...o, goto: sanitize(o.goto) })) }
              : {}),
            ...(s.exception && typeof s.exception === 'object'
              ? { exception: { ...s.exception, goto: sanitize(s.exception.goto) } }
              : {}),
          };
        });
      return { ...w, steps };
    });
  };

  const handleMoveStep = (stepId, dir) => {
    if (!selected) return;
    mutateWorkflow(selected.id, (w) => {
      const idx = w.steps.findIndex((s) => s.id === stepId);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= w.steps.length) return w;
      const steps = [...w.steps];
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...w, steps };
    });
  };

  // ---------- runner ----------
  const startRun = () => {
    if (!selected || !selected.steps.length) return;
    setRun({
      workflowId: selected.id,
      startedAt: Date.now(),
      finishedAt: null,
      currentId: selected.steps[0].id,
      path: [],
      viaBranch: false,
      handler: null,
      outcome: null,
    });
    setElapsed(0);
  };

  const finishRun = (r, outcome) => {
    const finishedAt = Date.now();
    const finalRun = { ...r, finishedAt, outcome };
    setRun(finalRun);
    update((prev) => ({
      ...prev,
      runs: [
        {
          id: makeId(),
          workflowId: r.workflowId,
          startedAt: r.startedAt,
          finishedAt,
          outcome,
          path: r.path,
          durationMs: finishedAt - r.startedAt,
        },
        ...prev.runs,
      ].slice(0, 200),
    }));
  };

  const advanceRun = (step, kind, { goto, label } = {}) => {
    if (!run || !selected) return;
    const entry = { stepId: step.id, title: step.title, type: step.type, kind, label };
    const path = [...run.path, entry];
    if (path.length > 300) {
      finishRun({ ...run, path }, 'loop-guard');
      return;
    }
    const branched = kind === 'issue' || kind === 'choice';
    const nextId = branched
      ? resolveGoto(selected, goto, step.id)
      : continuationFor(selected, step, run.viaBranch);
    if (!nextId) {
      finishRun({ ...run, path }, 'completed');
      return;
    }
    setRun({
      ...run,
      path,
      currentId: nextId,
      viaBranch: branched ? true : run.viaBranch,
      handler: kind === 'issue' ? { title: step.exception?.title, detail: step.exception?.detail } : run.handler,
    });
  };

  const abandonRun = () => {
    if (run && !run.finishedAt && run.path.length) finishRun(run, 'abandoned');
    else setRun(null);
  };

  const closeRunModal = () => {
    if (run && !run.finishedAt && run.path.length > 0) {
      const ok = window.confirm('Abandon the current run and close?');
      if (!ok) return;
      finishRun(run, 'abandoned');
    }
    setRunOpen(false);
    setRun(null);
  };

  const currentStep = run && selected ? selected.steps.find((s) => s.id === run.currentId) : null;
  const visitedIds = useMemo(() => new Set((run?.path || []).map((p) => p.stepId)), [run]);
  const progressPct = selected?.steps.length
    ? Math.min(100, Math.round((visitedIds.size / selected.steps.length) * 100))
    : 0;
  const workflowRuns = useMemo(
    () => runs.filter((r) => r.workflowId === selected?.id).slice(0, 5),
    [runs, selected],
  );
  const lastRunOf = (wfId) => runs.find((r) => r.workflowId === wfId);

  const openWorkflow = (wf) => {
    setSelectedWorkflowId(wf.id);
    setRunOpen(false);
    setRun(null);
  };

  // ---------- render ----------
  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto">
      <div className="max-w-[1500px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Workflow className="w-7 h-7 text-primary" /> Workflows
            </h1>
            <p className="text-muted-foreground">
              Step-by-step procedures with branches, exceptions and folders.
            </p>
          </div>
          <button
            onClick={handleCreateWorkflow}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition"
          >
            <Plus size={18} /> New workflow
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[210px_290px_minmax(0,1fr)] gap-4 md:gap-5 items-start">
          {/* ---------- folders ---------- */}
          <div className="rounded-2xl bg-secondary border border-border p-3 space-y-1">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
              Folders
              <button
                onClick={() => setAddingFolder((v) => !v)}
                className="p-1 rounded hover:bg-accent transition"
                title="New folder"
              >
                <FolderPlus size={14} />
              </button>
            </div>

            {addingFolder && (
              <div className="p-2 rounded-lg bg-background border border-border space-y-2">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                  placeholder="Folder name (e.g. Health)"
                  className="w-full bg-secondary border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex items-center gap-1.5">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewFolderColor(c)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition',
                        newFolderColor === c ? 'border-foreground scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddFolder}
                    className="flex-1 bg-primary text-primary-foreground text-xs py-1.5 rounded-md hover:bg-primary/90 transition"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingFolder(false)}
                    className="flex-1 bg-accent text-xs py-1.5 rounded-md hover:bg-accent/70 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {folders.map((f) => {
              const count = workflows.filter((w) => w.folderId === f.id).length;
              const active = f.id === folder?.id;
              return (
                <div key={f.id} className="group relative">
                  {editingFolderId === f.id ? (
                    <div className="flex items-center gap-1 p-1">
                      <input
                        autoFocus
                        value={folderDraft}
                        onChange={(e) => setFolderDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameFolder(f.id);
                          if (e.key === 'Escape') setEditingFolderId(null);
                        }}
                        className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={() => handleRenameFolder(f.id)} className="p-1 text-emerald-400" title="Save">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        update((prev) => ({ ...prev, selectedFolderId: f.id }));
                        setSelectedWorkflowId(null);
                        setRunOpen(false);
                        setRun(null);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition group',
                        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      )}
                    >
                      {active ? (
                        <FolderOpen size={16} style={{ color: f.color }} />
                      ) : (
                        <Folder size={16} style={{ color: f.color }} />
                      )}
                      <span className="flex-1 text-left truncate font-medium">{f.name}</span>
                      <span className="text-xs opacity-60">{count}</span>
                    </button>
                  )}
                  {active && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-secondary/90 rounded-md pr-1">
                      <button
                        onClick={() => {
                          setEditingFolderId(f.id);
                          setFolderDraft(f.name);
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(f.id)}
                        className="p-1 text-muted-foreground hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ---------- workflow list ---------- */}
          <div className="rounded-2xl bg-secondary border border-border p-3 space-y-2">
            <div className="px-2 py-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                {folder?.name || 'Folder'}
              </span>
            </div>
            <div className="px-1 pb-1">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter workflows…"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {folderWorkflows.length === 0 && (
              <div className="p-5 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {query ? 'No workflows match.' : 'This folder is empty.'}
                </p>
                {!query && (
                  <button
                    onClick={handleInsertExample}
                    className="inline-flex items-center gap-2 text-xs bg-accent hover:bg-accent/70 px-3 py-1.5 rounded-lg transition"
                  >
                    <Sparkles size={14} /> Insert example workflow
                  </button>
                )}
              </div>
            )}

            {folderWorkflows.map((wf) => {
              const active = wf.id === selectedWorkflowId;
              const last = lastRunOf(wf.id);
              return (
                <button
                  key={wf.id}
                  onClick={() => openWorkflow(wf)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition group',
                    active
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-transparent hover:bg-accent/60 hover:border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm leading-snug">{wf.title || 'Untitled'}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                      {wf.steps.length} step{wf.steps.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {wf.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{wf.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {wf.steps.slice(0, 5).map((s) => (
                      <span key={s.id} className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]', STEP_META[s.type]?.chip)}>
                        <StepIcon type={s.type} className="w-2.5 h-2.5" />
                        {STEP_META[s.type]?.label}
                      </span>
                    ))}
                    {wf.steps.length > 5 && (
                      <span className="text-[10px] text-muted-foreground">+{wf.steps.length - 5}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2">
                    {last
                      ? `Last run ${formatWhen(last.finishedAt)} · ${last.outcome === 'completed' ? 'completed' : last.outcome}`
                      : 'Never run'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ---------- detail / builder / runner ---------- */}
          <div className="rounded-2xl bg-secondary border border-border p-4 md:p-5 min-h-[420px]">
            {!selected && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 gap-3">
                <Workflow className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  Select a workflow, or create a new one to get started.
                </p>
                <button
                  onClick={handleCreateWorkflow}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm transition"
                >
                  <Plus size={16} /> New workflow
                </button>
              </div>
            )}

            {selected && (
              <>
                {/* header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      value={selected.title}
                      onChange={(e) => mutateWorkflow(selected.id, (w) => ({ ...w, title: e.target.value }))}
                      className="w-full bg-transparent text-xl font-bold tracking-tight focus:outline-none focus:ring-0 border-0 border-b border-transparent focus:border-primary/50 rounded-none p-0"
                      placeholder="Workflow title"
                    />
                    <input
                      value={selected.description || ''}
                      onChange={(e) => mutateWorkflow(selected.id, (w) => ({ ...w, description: e.target.value }))}
                      className="w-full bg-transparent text-sm text-muted-foreground focus:outline-none border-0 border-b border-transparent focus:border-primary/50 rounded-none p-0"
                      placeholder="Add a description…"
                    />
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <select
                        value={selected.folderId}
                        onChange={(e) => handleMoveWorkflow(selected.id, e.target.value)}
                        className="bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        title="Move to folder"
                      >
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDuplicateWorkflow(selected)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition"
                      >
                        <Copy size={12} /> Duplicate
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(selected.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-400 px-2 py-1 rounded-md hover:bg-accent transition"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRun(null);
                      setRunOpen(true);
                    }}
                    disabled={!selected.steps.length}
                    className={cn(
                      'inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition',
                      !selected.steps.length && 'opacity-40 cursor-not-allowed',
                    )}
                    title={selected.steps.length ? 'Run this workflow' : 'Add a step first'}
                  >
                    <Play size={15} />
                    Run
                  </button>
                </div>

                {/* ---------- builder ---------- */}
                <div className="pt-4 space-y-3">
                    {selected.steps.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No steps yet. Add your first step below.
                      </p>
                    )}

                    {selected.steps.map((step, i) => {
                      const meta = STEP_META[step.type] || STEP_META.task;
                      const branchTarget = isBranchTarget(selected, step.id);
                      const hasContinuation = step.type !== 'decision';
                      return (
                        <div
                          key={step.id}
                          className="rounded-xl border border-border bg-background p-3 md:p-4 space-y-3"
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-2 text-xs text-muted-foreground w-5 text-right tabular-nums">
                              {i + 1}.
                            </span>
                            <span
                              className={cn(
                                'mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap',
                                meta.chip,
                              )}
                            >
                              <StepIcon type={step.type} />
                              {meta.label}
                            </span>
                            {branchTarget && (
                              <span
                                className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[10px] font-medium whitespace-nowrap"
                                title="A decision branch or exception jumps here"
                              >
                                <GitBranch size={10} /> branch target
                              </span>
                            )}
                            <div className="flex-1 min-w-0 space-y-2">
                              <input
                                value={step.title}
                                onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                                placeholder="Step title"
                                className="w-full bg-transparent font-medium text-sm focus:outline-none border-0 border-b border-transparent focus:border-primary/40 rounded-none p-0"
                              />
                              <textarea
                                value={step.detail || ''}
                                onChange={(e) => handleUpdateStep(step.id, { detail: e.target.value })}
                                placeholder="Details / instructions (optional)"
                                rows={2}
                                className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                              />
                            </div>
                            <div className="flex flex-col md:flex-row items-center gap-0.5">
                              <button
                                onClick={() => handleMoveStep(step.id, -1)}
                                disabled={i === 0}
                                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                                title="Move up"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => handleMoveStep(step.id, 1)}
                                disabled={i === selected.steps.length - 1}
                                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                                title="Move down"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteStep(step.id)}
                                className="p-1.5 text-muted-foreground hover:text-rose-400 transition"
                                title="Delete step"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* continuation (task / note / exception) */}
                          {hasContinuation && (
                            <div className="pl-7 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <ArrowRight size={12} className="shrink-0" />
                              <span>After this step</span>
                              <ContinuationSelect
                                value={step.next}
                                onChange={(v) => handleUpdateStep(step.id, { next: v })}
                                steps={selected.steps}
                                currentStepId={step.id}
                                isBranchTargetStep={branchTarget}
                              />
                              {branchTarget && !step.next && (
                                <span className="text-[10px] text-muted-foreground/70">
                                  (reached via a branch — ends the run unless continued)
                                </span>
                              )}
                            </div>
                          )}

                          {/* task options */}
                          {step.type === 'task' && (
                            <div className="pl-7 space-y-2">
                              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!step.optional}
                                  onChange={(e) => handleUpdateStep(step.id, { optional: e.target.checked })}
                                  className="rounded accent-primary"
                                />
                                Optional — can be skipped while running
                              </label>
                              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!step.exception?.enabled}
                                  onChange={(e) =>
                                    handleUpdateStep(step.id, {
                                      exception: {
                                        enabled: e.target.checked,
                                        title: step.exception?.title || '',
                                        detail: step.exception?.detail || '',
                                        goto: step.exception?.goto || 'end',
                                      },
                                    })
                                  }
                                  className="rounded accent-primary"
                                />
                                <AlertTriangle size={12} className="text-amber-400" />
                                Has an exception handler (something can go wrong)
                              </label>
                              {step.exception?.enabled && (
                                <div className="ml-5 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                                  <input
                                    value={step.exception.title}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, {
                                        exception: { ...step.exception, title: e.target.value },
                                      })
                                    }
                                    placeholder="What goes wrong? (e.g. Machine broken)"
                                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                  />
                                  <textarea
                                    value={step.exception.detail}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, {
                                        exception: { ...step.exception, detail: e.target.value },
                                      })
                                    }
                                    placeholder="What should happen instead?"
                                    rows={2}
                                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
                                  />
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Link2 size={12} />
                                    Then jump to
                                    <GotoSelect
                                      value={step.exception.goto}
                                      onChange={(v) =>
                                        handleUpdateStep(step.id, {
                                          exception: { ...step.exception, goto: v },
                                        })
                                      }
                                      steps={selected.steps}
                                      currentStepId={step.id}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* decision options */}
                          {step.type === 'decision' && (
                            <div className="pl-7 space-y-2">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                                Branches
                              </p>
                              {(step.options || []).map((opt, oi) => (
                                <div key={opt.id} className="flex items-center gap-2">
                                  <input
                                    value={opt.label}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, {
                                        options: step.options.map((o) =>
                                          o.id === opt.id ? { ...o, label: e.target.value } : o,
                                        ),
                                      })
                                    }
                                    placeholder={`Option ${oi + 1}`}
                                    className="w-40 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                  />
                                  <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                                  <GotoSelect
                                    value={opt.goto}
                                    onChange={(v) =>
                                      handleUpdateStep(step.id, {
                                        options: step.options.map((o) =>
                                          o.id === opt.id ? { ...o, goto: v } : o,
                                        ),
                                      })
                                    }
                                    steps={selected.steps}
                                    currentStepId={step.id}
                                  />
                                  {(step.options || []).length > 2 && (
                                    <button
                                      onClick={() =>
                                        handleUpdateStep(step.id, {
                                          options: step.options.filter((o) => o.id !== opt.id),
                                        })
                                      }
                                      className="p-1 text-muted-foreground hover:text-rose-400"
                                      title="Remove branch"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {(step.options || []).length < 4 && (
                                <button
                                  onClick={() =>
                                    handleUpdateStep(step.id, {
                                      options: [
                                        ...step.options,
                                        { id: makeId(), label: `Option ${step.options.length + 1}`, goto: 'next' },
                                      ],
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                                >
                                  <Plus size={12} /> Add branch
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* add step */}
                    <div className="relative" ref={addStepRef}>
                      <button
                        onClick={() => setAddStepOpen((v) => !v)}
                        className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-xl py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition"
                      >
                        <Plus size={16} /> Add step
                      </button>
                      {addStepOpen && (
                        <div className="absolute z-20 left-1/2 -translate-x-1/2 mt-2 w-64 rounded-xl bg-background border border-border shadow-xl p-2 space-y-1">
                          {[
                            { type: 'task', icon: ListChecks, desc: 'Something to do & check off' },
                            { type: 'decision', icon: GitBranch, desc: 'If / else branch point' },
                            { type: 'exception', icon: AlertTriangle, desc: 'A fallback handler card' },
                            { type: 'note', icon: StickyNote, desc: 'Info shown during the run' },
                          ].map((item) => (
                            <button
                              key={item.type}
                              onClick={() => handleAddStep(item.type)}
                              className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-accent transition text-left"
                            >
                              <item.icon size={16} className={cn('mt-0.5 shrink-0', STEP_META[item.type].color)} />
                              <span>
                                <span className="block text-sm font-medium">{STEP_META[item.type].label}</span>
                                <span className="block text-xs text-muted-foreground">{item.desc}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* run history */}
                    {workflowRuns.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
                          <History size={12} /> Recent runs
                        </p>
                        <div className="space-y-1">
                          {workflowRuns.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-background border border-border"
                            >
                              <span className="flex items-center gap-1.5">
                                {r.outcome === 'completed' ? (
                                  <CheckCircle2 size={12} className="text-emerald-400" />
                                ) : r.outcome === 'abandoned' ? (
                                  <X size={12} className="text-rose-400" />
                                ) : (
                                  <AlertTriangle size={12} className="text-amber-400" />
                                )}
                                <span className="text-muted-foreground">{formatWhen(r.finishedAt)}</span>
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-muted-foreground">{r.path?.length || 0} steps</span>
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Clock size={11} /> {formatDuration(r.durationMs)}
                                </span>
                                <span
                                  className={cn(
                                    'font-medium',
                                    r.outcome === 'completed'
                                      ? 'text-emerald-400'
                                      : r.outcome === 'abandoned'
                                        ? 'text-rose-400'
                                        : 'text-amber-400',
                                  )}
                                >
                                  {r.outcome}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                {/* ---------- runner (opens as a modal) ---------- */}
                {runOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                      onClick={closeRunModal}
                    />
                    <div className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-secondary border border-border shadow-2xl">
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-secondary">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Workflow run</p>
                          <h2 className="font-semibold truncate">{selected.title}</h2>
                        </div>
                        <button
                          onClick={closeRunModal}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
                          title="Close run"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="p-5">
                        <div>
                    {!run && (
                      <div className="text-center py-14 space-y-4">
                        <Play className="w-10 h-10 text-primary mx-auto" />
                        <div>
                          <p className="font-medium">Ready to run</p>
                          <p className="text-sm text-muted-foreground">
                            {selected.steps.length} step{selected.steps.length === 1 ? '' : 's'} · decisions and
                            exceptions will guide the path.
                          </p>
                        </div>
                        <button
                          onClick={startRun}
                          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg transition"
                        >
                          <Play size={16} /> Start run
                        </button>
                      </div>
                    )}

                    {run && !run.finishedAt && currentStep && (
                      <div className="space-y-4">
                        {/* progress */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              Step {selected.steps.findIndex((s) => s.id === currentStep.id) + 1} of{' '}
                              {selected.steps.length} · {visitedIds.size} done
                            </span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <Clock size={11} /> {formatDuration(elapsed)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-background border border-border overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {run.handler && (
                          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
                            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                            <div className="text-sm">
                              <p className="font-medium text-amber-400">
                                Exception: {run.handler.title || 'Something went wrong'}
                              </p>
                              {run.handler.detail && (
                                <p className="text-muted-foreground text-xs mt-0.5">{run.handler.detail}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* current step card */}
                        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 md:p-6 space-y-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
                              STEP_META[currentStep.type]?.chip,
                            )}
                          >
                            <StepIcon type={currentStep.type} />
                            {STEP_META[currentStep.type]?.label}
                            {currentStep.optional && <span className="opacity-70">· optional</span>}
                          </span>
                          <div>
                            <h2 className="text-2xl font-bold tracking-tight">{currentStep.title}</h2>
                            {currentStep.detail && (
                              <p className="text-muted-foreground mt-2 whitespace-pre-wrap">{currentStep.detail}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {currentStep.type === 'task' && (
                              <>
                                <button
                                  onClick={() => advanceRun(currentStep, 'done')}
                                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition"
                                >
                                  <Check size={16} /> Done
                                </button>
                                {currentStep.optional && (
                                  <button
                                    onClick={() => advanceRun(currentStep, 'skipped')}
                                    className="inline-flex items-center gap-2 bg-accent hover:bg-accent/70 px-4 py-2 rounded-lg text-sm font-medium transition"
                                  >
                                    <SkipForward size={14} /> Skip
                                  </button>
                                )}
                                {currentStep.exception?.enabled && (
                                  <button
                                    onClick={() =>
                                      advanceRun(currentStep, 'issue', { goto: currentStep.exception.goto })
                                    }
                                    className="inline-flex items-center gap-2 border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 px-4 py-2 rounded-lg text-sm font-medium transition"
                                  >
                                    <AlertTriangle size={14} /> Something went wrong
                                  </button>
                                )}
                              </>
                            )}

                            {currentStep.type === 'note' && (
                              <button
                                onClick={() => advanceRun(currentStep, 'read')}
                                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition"
                              >
                                Got it <ArrowRight size={14} />
                              </button>
                            )}

                            {currentStep.type === 'decision' && (
                              <div className="flex flex-wrap gap-2 w-full">
                                {(currentStep.options || []).map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={() =>
                                      advanceRun(currentStep, 'choice', { goto: opt.goto, label: opt.label })
                                    }
                                    className="inline-flex items-center gap-2 bg-accent hover:bg-accent/70 px-4 py-2 rounded-lg text-sm font-medium transition"
                                  >
                                    {opt.label || 'Option'} <ArrowRight size={14} />
                                  </button>
                                ))}
                              </div>
                            )}

                            {currentStep.type === 'exception' && (
                              <button
                                onClick={() => advanceRun(currentStep, 'handled')}
                                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition"
                              >
                                <Check size={16} /> Handled it
                              </button>
                            )}
                          </div>

                          {currentStep.type !== 'decision' &&
                            (() => {
                              const nextId = continuationFor(selected, currentStep, run.viaBranch);
                              if (!nextId) {
                                return (
                                  <p className="text-xs text-muted-foreground">
                                    After this: the run ends here.
                                  </p>
                                );
                              }
                              const target = selected.steps.find((s) => s.id === nextId);
                              return (
                                <p className="text-xs text-muted-foreground">
                                  After this: {target?.title || 'next step'}
                                </p>
                              );
                            })()}
                        </div>

                        {/* trail */}
                        {run.path.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Path taken
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {run.path.map((p, i) => (
                                <span
                                  key={`${p.stepId}-${i}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border text-[11px] text-muted-foreground"
                                >
                                  <StepIcon type={p.type} className="w-3 h-3" />
                                  {p.title}
                                  {p.kind === 'skipped' && ' (skipped)'}
                                  {p.kind === 'issue' && ' ⚠'}
                                  {p.kind === 'choice' && ` → ${p.label}`}
                                </span>
                              ))}
                              <ArrowRight size={12} className="text-muted-foreground" />
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-[11px] font-medium">
                                <Circle size={8} className="fill-primary text-primary" /> now
                              </span>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={abandonRun}
                          className="text-xs text-muted-foreground hover:text-rose-400 transition inline-flex items-center gap-1"
                        >
                          <X size={12} /> Abandon run
                        </button>
                      </div>
                    )}

                    {run && run.finishedAt && (
                      <div className="text-center py-10 space-y-5">
                        <div
                          className={cn(
                            'w-16 h-16 rounded-full mx-auto flex items-center justify-center border',
                            run.outcome === 'completed'
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                              : run.outcome === 'abandoned'
                                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                                : 'bg-amber-500/10 border-amber-500/40 text-amber-400',
                          )}
                        >
                          {run.outcome === 'completed' ? (
                            <CheckCircle2 size={30} />
                          ) : run.outcome === 'abandoned' ? (
                            <Flag size={26} />
                          ) : (
                            <AlertTriangle size={26} />
                          )}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold tracking-tight">
                            {run.outcome === 'completed'
                              ? 'Workflow complete!'
                              : run.outcome === 'abandoned'
                                ? 'Run abandoned'
                                : 'Run stopped (loop guard)'}
                          </h2>
                          <p className="text-muted-foreground text-sm mt-1">
                            {formatDuration(run.finishedAt - run.startedAt)} · {run.path.length} steps taken
                          </p>
                        </div>

                        <div className="max-w-md mx-auto text-left space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Your path
                          </p>
                          {run.path.map((p, i) => (
                            <div
                              key={`${p.stepId}-${i}`}
                              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-background border border-border"
                            >
                              <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                              <StepIcon type={p.type} />
                              <span className="flex-1 truncate">{p.title}</span>
                              <span className="text-muted-foreground">
                                {p.kind === 'done' && 'done'}
                                {p.kind === 'skipped' && 'skipped'}
                                {p.kind === 'issue' && '⚠ issue'}
                                {p.kind === 'choice' && `→ ${p.label}`}
                                {p.kind === 'read' && 'read'}
                                {p.kind === 'handled' && 'handled'}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={startRun}
                            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm transition"
                          >
                            <RotateCcw size={14} /> Run again
                          </button>
                          <button
                            onClick={() => {
                              setRunOpen(false);
                              setRun(null);
                            }}
                            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/70 px-4 py-2 rounded-lg text-sm transition"
                          >
                            <Pencil size={14} /> Back to builder
                          </button>
                        </div>
                      </div>
                    )}

                    {run && !run.finishedAt && !currentStep && (
                      <div className="text-center py-10 space-y-3">
                        <p className="text-muted-foreground text-sm">
                          This step no longer exists — the workflow changed while running.
                        </p>
                        <button
                          onClick={() => setRun(null)}
                          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"
                        >
                          Restart
                        </button>
                      </div>
                    )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workflows;
