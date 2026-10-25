import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ArrowLeft, FileText, Image as ImageIcon, Clapperboard, Music4,
  Upload, Check, Loader2, AlertCircle, Plus,
} from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Waveform from './Waveform';
import {
  readImageMeta, readVideoMeta, computeWaveform,
  fileNameToTitle, toLocalInput, formatDuration,
} from '../../utils/art';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const FIELD = 'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors';
const FIELD_MISSING = 'border-amber-500/70';
const LABEL = 'block text-xs font-medium text-muted-foreground mb-1.5';
const PRIMARY = 'px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2';
const GHOST = 'px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/50 transition-colors flex items-center gap-2';

const TYPES = [
  { key: 'blog', label: 'Blog', heading: 'Publish a post', icon: FileText, hint: 'Write or paste text, with images if you like.' },
  { key: 'photo', label: 'Photograph', heading: 'Publish a photograph', icon: ImageIcon, hint: 'Details are read straight from the photo.' },
  { key: 'video', label: 'Video', heading: 'Publish a video', icon: Clapperboard, hint: 'Details are read from the video file.' },
  { key: 'music', label: 'Music', heading: 'Publish a track', icon: Music4, hint: 'Upload a track and get a real waveform.' },
];

const formatBytes = (bytes = 0) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const Spinner = ({ label }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
    <Loader2 className="w-4 h-4 animate-spin" />
    {label}
  </div>
);

const ErrorNote = ({ children }) =>
  children ? (
    <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  ) : null;

const Field = ({ label, hint, missing, as = 'input', ...props }) => {
  const Element = as;
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <Element
        {...props}
        className={cn(FIELD, as === 'textarea' && 'min-h-[110px] leading-relaxed', missing && FIELD_MISSING, props.className)}
      />
      {missing && <p className="text-[11px] text-amber-500 mt-1">Not found in the file — please add it</p>}
    </div>
  );
};

const FormShell = ({ onBack, onSubmit, submitLabel, busy, error, children, footerNote }) => (
  <div>
    <div className="space-y-4">{children}</div>
    <ErrorNote>{error}</ErrorNote>
    {busy && <Spinner label={busy} />}
    <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-border">
      <button type="button" onClick={onBack} className={GHOST}>
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <div className="flex items-center gap-3">
        {footerNote && <span className="hidden sm:block text-xs text-muted-foreground">{footerNote}</span>}
        <button type="button" onClick={onSubmit} disabled={!!busy} className={PRIMARY}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {submitLabel}
        </button>
      </div>
    </div>
  </div>
);

const usePreviewRevoke = () => {
  const previews = useRef([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);
  return previews;
};

const BlogForm = ({ onBack, onDone }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const previews = usePreviewRevoke();
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/')).slice(0, 16);
    if (!files.length) return;
    setBusy('Reading image details…');
    setError('');
    try {
      const entries = await Promise.all(files.map(async (file) => {
        const preview = URL.createObjectURL(file);
        previews.current.push(preview);
        const meta = await readImageMeta(file);
        return { file, preview, meta };
      }));
      setImages((previous) => [...previous, ...entries]);
    } catch (err) {
      setError('That image could not be read.');
    }
    setBusy('');
  };

  const removeImage = (index) => {
    setImages((previous) => previous.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!title.trim()) {
      setError('Give the post a title.');
      return;
    }
    if (!content.trim() && images.length === 0) {
      setError('Write something or attach at least one image.');
      return;
    }
    setBusy('Publishing…');
    setError('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('content', content);
      form.append('imageMeta', JSON.stringify(images.map((entry) => entry.meta)));
      images.forEach((entry) => form.append('images', entry.file));
      await axios.post('/art/blogs', form);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'The post could not be published.');
      setBusy('');
    }
  };

  return (
    <FormShell onBack={onBack} onSubmit={submit} submitLabel="Publish post" busy={busy} error={error} footerNote={`${content.trim().length} characters`}>
      <div>
        <label className={LABEL}>Title</label>
        <input
          className={FIELD}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Name this piece"
        />
      </div>

      <div>
        <label className={LABEL}>Your writing</label>
        <textarea
          className={cn(FIELD, 'min-h-[200px] leading-relaxed')}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste or write your text here…"
        />
      </div>

      <div>
        <label className={LABEL}>Attach images (optional)</label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()} className={GHOST}>
          <Plus className="w-4 h-4" />
          Choose images
        </button>
        <p className="text-[11px] text-muted-foreground mt-2">
          Every attached image is also published to your Photographs gallery.
        </p>

        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {images.map((entry, index) => (
              <div key={`${entry.file.name}-${index}`} className="rounded-lg border border-border bg-secondary overflow-hidden">
                <img src={entry.preview} alt="" className="w-full h-24 object-cover" />
                <div className="p-2">
                  <p className="text-xs truncate">{entry.meta.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {entry.meta.takenAt ? new Date(entry.meta.takenAt).toLocaleDateString() : 'no date found'}
                    {entry.meta.location ? ` · ${entry.meta.location}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="mt-1 text-[10px] text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FormShell>
  );
};

const FileDrop = ({ accept, label, hint, onFile, file }) => {
  const inputRef = useRef(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(GHOST, 'w-full justify-center py-6 border-dashed', file && 'border-primary/50')}
      >
        <Upload className="w-4 h-4" />
        {file ? file.name : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) onFile(picked);
          event.target.value = '';
        }}
      />
      {hint && <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
};

const DetectedBanner = ({ detected }) => (
  <div className="flex items-start gap-2 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
    <Check className="w-4 h-4 mt-0.5 shrink-0" />
    <span>
      {detected?.length
        ? `Read from the file: ${detected.join(', ')}. Confirm below and fill in anything missing.`
        : 'No usable metadata was found in this file — please fill in the details yourself.'}
    </span>
  </div>
);

const PhotoForm = ({ onBack, onDone }) => {
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [fields, setFields] = useState({ title: '', description: '', location: '', takenAt: '', camera: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const previews = usePreviewRevoke();

  const handleFile = async (picked) => {
    setError('');
    setFile(picked);
    const preview = URL.createObjectURL(picked);
    previews.current.push(preview);
    setBusy('Reading photo metadata…');
    try {
      const details = await readImageMeta(picked);
      setMeta(details);
      setFields({
        title: details.title,
        description: details.description,
        location: details.location,
        takenAt: details.takenAt,
        camera: details.camera,
      });
    } catch (err) {
      setError('That image could not be read.');
    }
    setBusy('');
  };

  const update = (key) => (event) => setFields((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async () => {
    if (!file) {
      setError('Choose a photograph first.');
      return;
    }
    if (!fields.title.trim()) {
      setError('Give the photograph a title.');
      return;
    }
    setBusy('Publishing…');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      form.append('width', meta?.width || 0);
      form.append('height', meta?.height || 0);
      await axios.post('/art/photos', form);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'The photograph could not be published.');
      setBusy('');
    }
  };

  return (
    <FormShell onBack={onBack} onSubmit={submit} submitLabel="Publish photograph" busy={busy} error={error}>
      <FileDrop
        accept="image/*"
        label="Choose a photograph"
        hint="JPG, PNG, HEIC or WebP — up to 25 MB."
        file={file}
        onFile={handleFile}
      />

      {file && (
        <div className="rounded-lg overflow-hidden border border-border bg-secondary">
          <img src={previews.current[previews.current.length - 1]} alt="" className="w-full max-h-56 object-contain bg-black/40" />
        </div>
      )}

      {busy && <Spinner label={busy} />}
      {meta && <DetectedBanner detected={meta.detected} />}

      {meta && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {meta.width > 0 && <span>{meta.width} × {meta.height} px</span>}
          {file && <span>{formatBytes(file.size)}</span>}
          {meta.camera && <span>{meta.camera}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title" value={fields.title} onChange={update('title')} placeholder="What is it called" />
        <Field
          label="Date & time"
          type="datetime-local"
          value={fields.takenAt}
          onChange={update('takenAt')}
          missing={!fields.takenAt}
        />
      </div>

      <Field
        as="textarea"
        label="Description"
        value={fields.description}
        onChange={update('description')}
        placeholder="What should someone know about this image?"
        missing={!fields.description.trim()}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Location" value={fields.location} onChange={update('location')} placeholder="City, country or coordinates" missing={!fields.location.trim()} />
        <Field label="Camera" value={fields.camera} onChange={update('camera')} placeholder="Make and model" />
      </div>
    </FormShell>
  );
};

const VideoForm = ({ onBack, onDone }) => {
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [fields, setFields] = useState({ title: '', description: '', location: '', recordedAt: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const previews = usePreviewRevoke();

  const handleFile = async (picked) => {
    setError('');
    setFile(picked);
    const preview = URL.createObjectURL(picked);
    previews.current.push(preview);
    setBusy('Reading video metadata…');
    try {
      const details = await readVideoMeta(picked);
      setMeta(details);
      setFields((previous) => ({
        title: details.title,
        description: previous.description,
        location: previous.location,
        recordedAt: details.recordedAt,
      }));
    } catch (err) {
      setError('That video could not be read.');
    }
    setBusy('');
  };

  const update = (key) => (event) => setFields((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async () => {
    if (!file) {
      setError('Choose a video first.');
      return;
    }
    if (!fields.title.trim()) {
      setError('Give the video a title.');
      return;
    }
    setBusy('Publishing…');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      form.append('duration', meta?.duration || 0);
      form.append('width', meta?.width || 0);
      form.append('height', meta?.height || 0);
      await axios.post('/art/videos', form);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'The video could not be published.');
      setBusy('');
    }
  };

  return (
    <FormShell onBack={onBack} onSubmit={submit} submitLabel="Publish video" busy={busy} error={error}>
      <FileDrop
        accept="video/*"
        label="Choose a video"
        hint="MP4, MOV or WebM — up to 500 MB."
        file={file}
        onFile={handleFile}
      />

      {file && (
        <div className="rounded-lg overflow-hidden border border-border bg-black">
          <video src={previews.current[previews.current.length - 1]} controls className="w-full max-h-56" />
        </div>
      )}

      {busy && <Spinner label={busy} />}
      {meta && <DetectedBanner detected={meta.detected} />}

      {meta && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {meta.width > 0 && <span>{meta.width} × {meta.height} px</span>}
          {meta.duration > 0 && <span>{formatDuration(meta.duration)}</span>}
          {file && <span>{formatBytes(file.size)}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title" value={fields.title} onChange={update('title')} placeholder="What is it called" />
        <Field
          label="Date & time of recording"
          type="datetime-local"
          value={fields.recordedAt}
          onChange={update('recordedAt')}
          missing={!fields.recordedAt}
        />
      </div>

      <Field
        as="textarea"
        label="Description"
        value={fields.description}
        onChange={update('description')}
        placeholder="What is happening in this clip?"
        missing={!fields.description.trim()}
      />

      <Field label="Location" value={fields.location} onChange={update('location')} placeholder="Where was this shot?" missing={!fields.location.trim()} />
    </FormShell>
  );
};

const MusicForm = ({ onBack, onDone }) => {
  const [file, setFile] = useState(null);
  const [wave, setWave] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fields, setFields] = useState({ title: '', description: '', madeAt: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const previews = usePreviewRevoke();

  const handleFile = async (picked) => {
    setError('');
    setFile(picked);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const preview = URL.createObjectURL(picked);
    previews.current.push(preview);
    setPreviewUrl(preview);
    setWave(null);
    setFields((previous) => ({
      title: previous.title || fileNameToTitle(picked.name),
      description: previous.description,
      madeAt: previous.madeAt || toLocalInput(picked.lastModified),
    }));
    setBusy('Analysing the audio to draw an accurate waveform…');
    try {
      const result = await computeWaveform(picked);
      setWave(result);
    } catch (err) {
      setError('This audio file could not be decoded by your browser. Try an MP3 or WAV.');
    }
    setBusy('');
  };

  const update = (key) => (event) => setFields((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = async () => {
    if (!file) {
      setError('Choose an audio file first.');
      return;
    }
    if (!wave) {
      setError('The waveform is still being prepared.');
      return;
    }
    if (!fields.title.trim()) {
      setError('Give the track a name.');
      return;
    }
    setBusy('Publishing…');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      form.append('duration', String(wave.duration || 0));
      form.append('peaks', JSON.stringify(wave.peaks));
      await axios.post('/art/music', form);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'The track could not be published.');
      setBusy('');
    }
  };

  return (
    <FormShell onBack={onBack} onSubmit={submit} submitLabel="Publish track" busy={busy} error={error}>
      <FileDrop
        accept="audio/*"
        label="Choose a track"
        hint="MP3, WAV, M4A or OGG — up to 200 MB."
        file={file}
        onFile={handleFile}
      />

      {busy && <Spinner label={busy} />}

      {wave && (
        <div className="rounded-lg border border-border bg-secondary p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Waveform drawn from your file</span>
            <span>{formatDuration(wave.duration)}</span>
          </div>
          <Waveform peaks={wave.peaks} progress={0} height={68} />
          {previewUrl && <audio controls src={previewUrl} className="w-full mt-3" />}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name of the music" value={fields.title} onChange={update('title')} placeholder="What is it called" />
        <Field
          label="Date & time of creation"
          type="datetime-local"
          value={fields.madeAt}
          onChange={update('madeAt')}
          missing={!fields.madeAt}
        />
      </div>

      <Field
        as="textarea"
        label="What is this music like?"
        value={fields.description}
        onChange={update('description')}
        placeholder="Mood, instruments, the story behind it…"
        missing={!fields.description.trim()}
      />
    </FormShell>
  );
};

const ArtUploadModal = ({ onClose, onDone }) => {
  const [type, setType] = useState(null);

  const active = TYPES.find((item) => item.key === type);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-background border border-border p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold">{active ? active.heading : 'What would you like to upload?'}</h2>
            <p className="text-sm text-muted-foreground">
              {active ? 'Everything you publish appears on your public Sid-Art site.' : 'Choose the kind of work you are adding.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -m-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!type && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setType(item.key)}
                className="text-left p-4 rounded-xl bg-secondary border border-border hover:border-primary/60 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-background border border-border flex items-center justify-center group-hover:text-primary transition-colors">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {type === 'blog' && <BlogForm onBack={() => setType(null)} onDone={onDone} />}
        {type === 'photo' && <PhotoForm onBack={() => setType(null)} onDone={onDone} />}
        {type === 'video' && <VideoForm onBack={() => setType(null)} onDone={onDone} />}
        {type === 'music' && <MusicForm onBack={() => setType(null)} onDone={onDone} />}
      </div>
    </div>,
    document.body
  );
};

export default ArtUploadModal;
