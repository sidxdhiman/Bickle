import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Upload, ArrowUpRight, FileText, Image as ImageIcon, Clapperboard,
  Music4, Trash2, Palette, Loader2, Plus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ArtUploadModal from '../components/art/ArtUploadModal';
import { mediaUrl, formatDate, formatDuration } from '../utils/art';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const EMPTY = { blogs: [], photos: [], videos: [], music: [] };

const Art = () => {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [busyKey, setBusyKey] = useState('');

  const fetchData = async () => {
    try {
      const [blogs, photos, videos, music] = await Promise.all([
        axios.get('/art/blogs'),
        axios.get('/art/photos'),
        axios.get('/art/videos'),
        axios.get('/art/music'),
      ]);
      setData({
        blogs: blogs.data,
        photos: photos.data,
        videos: videos.data,
        music: music.data,
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Your published work could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this from your art site?')) return;
    setBusyKey(id);
    try {
      await axios.delete(`/art/${type}/${id}`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete that item.');
    } finally {
      setBusyKey('');
    }
  };

  const handleSaved = async () => {
    setShowUpload(false);
    await fetchData();
  };

  const counts = [
    { key: 'blogs', label: 'Blogs', icon: FileText, value: data.blogs.length },
    { key: 'photos', label: 'Photographs', icon: ImageIcon, value: data.photos.length },
    { key: 'videos', label: 'Videos', icon: Clapperboard, value: data.videos.length },
    { key: 'music', label: 'Music', icon: Music4, value: data.music.length },
  ];

  const panels = [
    {
      key: 'blogs',
      label: 'Blogs',
      icon: FileText,
      items: data.blogs,
      empty: 'No posts yet.',
      render: (item) => ({
        title: item.title,
        meta: formatDate(item.createdAt),
        image: item.images?.[0],
      }),
    },
    {
      key: 'photos',
      label: 'Photographs',
      icon: ImageIcon,
      items: data.photos,
      empty: 'No photographs yet.',
      render: (item) => ({
        title: item.title || 'Untitled',
        meta: [formatDate(item.takenAt || item.createdAt), item.location].filter(Boolean).join(' · '),
        image: item.url,
      }),
    },
    {
      key: 'videos',
      label: 'Videos',
      icon: Clapperboard,
      items: data.videos,
      empty: 'No videos yet.',
      render: (item) => ({
        title: item.title || 'Untitled',
        meta: [item.duration ? formatDuration(item.duration) : '', formatDate(item.recordedAt || item.createdAt)]
          .filter(Boolean)
          .join(' · '),
        video: item.url,
      }),
    },
    {
      key: 'music',
      label: 'Music',
      icon: Music4,
      items: data.music,
      empty: 'No tracks yet.',
      render: (item) => ({
        title: item.title || 'Untitled',
        meta: [item.duration ? formatDuration(item.duration) : '', formatDate(item.madeAt || item.createdAt)]
          .filter(Boolean)
          .join(' · '),
      }),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Palette className="w-7 h-7 text-primary" />
            Art
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Publish blogs, photographs, videos and music to your public Sid-Art site.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowUpload(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <button
            onClick={() => window.open('/sid-art', '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 rounded-lg bg-secondary border border-border text-sm font-medium hover:border-primary/50 transition-colors flex items-center gap-2"
          >
            Go to Art Site
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {error && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {counts.map((count) => (
          <div key={count.key} className="p-4 rounded-2xl bg-secondary border border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-muted-foreground">{count.label}</p>
              <count.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{count.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your work…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          {panels.map((panel) => (
            <section key={panel.key} className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <panel.icon className="w-4 h-4" />
                  {panel.label}
                </h3>
                <span className="text-xs text-muted-foreground">{panel.items.length}</span>
              </div>

              {panel.items.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">{panel.empty}</div>
              ) : (
                <div className="space-y-2">
                  {panel.items.map((item) => {
                    const info = panel.render(item);
                    return (
                      <div
                        key={item._id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border hover:border-primary/50 transition-colors"
                      >
                        {info.video ? (
                          <video
                            src={mediaUrl(info.video)}
                            muted
                            preload="metadata"
                            className="w-11 h-11 rounded object-cover bg-black shrink-0"
                          />
                        ) : info.image ? (
                          <img
                            src={mediaUrl(info.image)}
                            alt=""
                            className="w-11 h-11 rounded object-cover bg-black shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0">
                            <panel.icon className="w-4 h-4" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{info.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{info.meta}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(panel.key, item._id)}
                          disabled={busyKey === item._id}
                          aria-label="Delete"
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          {busyKey === item._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Plus className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <h3 className="text-base sm:text-lg font-semibold">Add something new</h3>
            <p className="text-sm text-muted-foreground">
              Blogs can carry images, and every image you attach also lands in your gallery.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      {showUpload && <ArtUploadModal onClose={() => setShowUpload(false)} onDone={handleSaved} />}
    </div>
  );
};

export default Art;
