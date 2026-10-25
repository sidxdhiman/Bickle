import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  Phone, Mail, Linkedin, Github, X, MapPin, CalendarDays,
  Camera, Loader2, Image as ImageIcon, Clapperboard, Music4, FileText,
} from 'lucide-react';
import axios from 'axios';
import MusicPlayer from '../components/art/MusicPlayer';
import { mediaUrl, formatDate, formatDuration } from '../utils/art';

const EASE = [0.22, 1, 0.36, 1];
const CREAM = '#F7F2E7';
const PANEL = '#FBF7EE';
const INK = '#0B0B0B';

const TITLE = 'Sid-Art'.split('');

const NAV_ITEMS = [
  { key: 'blogs', label: 'Blogs', icon: FileText },
  { key: 'photographs', label: 'Photographs', icon: ImageIcon },
  { key: 'videos', label: 'Videos', icon: Clapperboard },
  { key: 'music', label: 'Music', icon: Music4 },
];

const CONTACTS = [
  { key: 'phone', label: '+91 00000 00000', icon: Phone, href: 'tel:+910000000000' },
  { key: 'email', label: 'your.address@gmail.com', icon: Mail, href: 'mailto:your.address@gmail.com' },
  {
    key: 'linkedin',
    label: 'linkedin.com/in/your-handle',
    icon: Linkedin,
    href: 'https://linkedin.com/in/your-handle',
  },
  {
    key: 'github',
    label: 'github.com/your-handle',
    icon: Github,
    href: 'https://github.com/your-handle',
  },
];

const EMPTY = { blogs: [], photos: [], videos: [], music: [] };

const SectionHeading = ({ label, index, total, count }) => (
  <div className="flex items-baseline justify-between gap-6 border-b border-black/15 pb-5">
    <h2 className="text-3xl sm:text-5xl italic tracking-[-0.01em]">{label}</h2>
    <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.4em] text-black/40">
      {count > 0 ? `${String(count).padStart(2, '0')} pieces` : `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}
    </span>
  </div>
);

const EmptyState = ({ message }) => (
  <div className="mt-14 border border-black/15 px-6 py-20 text-center">
    <div className="mx-auto h-px w-16 bg-black/20" />
    <p className="mt-8 text-xl sm:text-3xl italic text-black/75">{message}</p>
    <div className="mx-auto mt-8 h-px w-16 bg-black/20" />
  </div>
);

const LoadingState = () => (
  <div className="mt-16 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.4em] text-black/40">
    <Loader2 className="w-4 h-4 animate-spin" />
    Loading the studio
  </div>
);

const MetaRow = ({ icon: Icon, children }) =>
  children ? (
    <div className="flex items-start gap-2 text-xs sm:text-sm text-black/65">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
      <span>{children}</span>
    </div>
  ) : null;

const wordCount = (text = '') => text.trim().split(/\s+/).filter(Boolean).length;

const splitParagraphs = (text = '') =>
  text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

const SidArt = () => {
  const [active, setActive] = useState(NAV_ITEMS[0].key);
  const [contactOpen, setContactOpen] = useState(false);
  const [content, setContent] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openBlogId, setOpenBlogId] = useState(null);
  const [activeTrackId, setActiveTrackId] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    const previousTitle = document.title;
    const root = document.documentElement;
    const previousRootBg = root.style.backgroundColor;
    const previousBodyBg = document.body.style.backgroundColor;
    document.title = 'Sid-Art';
    root.style.backgroundColor = CREAM;
    document.body.style.backgroundColor = CREAM;
    return () => {
      document.title = previousTitle;
      root.style.backgroundColor = previousRootBg;
      document.body.style.backgroundColor = previousBodyBg;
    };
  }, []);

  const loadContent = async () => {
    try {
      const [blogs, photos, videos, music] = await Promise.all([
        axios.get('/art/blogs'),
        axios.get('/art/photos'),
        axios.get('/art/videos'),
        axios.get('/art/music'),
      ]);
      setContent({ blogs: blogs.data, photos: photos.data, videos: videos.data, music: music.data });
      setLoadError('');
    } catch (error) {
      setLoadError('The gallery could not be reached right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    if (!openBlogId && content.blogs.length) setOpenBlogId(content.blogs[0]._id);
  }, [content.blogs, openBlogId]);

  useEffect(() => {
    if (!activeTrackId && content.music.length) setActiveTrackId(content.music[0]._id);
  }, [content.music, activeTrackId]);

  const currentIndex = NAV_ITEMS.findIndex((item) => item.key === active) + 1;
  const activeTrack = content.music.find((track) => track._id === activeTrackId);

  const renderBlogs = () => (
    <div>
      <SectionHeading label="Blogs" index={currentIndex} total={NAV_ITEMS.length} count={content.blogs.length} />
      {content.blogs.length === 0 ? (
        <EmptyState message="No posts written here yet." />
      ) : (
        <div className="mt-8 space-y-5">
          {content.blogs.map((blog) => {
            const isOpen = blog._id === openBlogId;
            const paragraphs = splitParagraphs(blog.content);
            const excerpt = paragraphs[0]?.slice(0, 180);
            return (
              <article key={blog._id} className="border border-black/15 bg-black/[0.015]">
                <button
                  type="button"
                  onClick={() => setOpenBlogId(isOpen ? null : blog._id)}
                  className="w-full text-left px-5 sm:px-7 py-5 sm:py-6 flex items-start justify-between gap-5"
                >
                  <div className="min-w-0">
                    <h3 className="text-2xl sm:text-3xl italic leading-tight">{blog.title}</h3>
                    <p className="mt-2 text-[9px] sm:text-[10px] uppercase tracking-[0.35em] text-black/40">
                      {formatDate(blog.createdAt)}
                      {wordCount(blog.content) > 0 && ` · ${wordCount(blog.content)} words`}
                      {blog.images?.length > 0 && ` · ${blog.images.length} image${blog.images.length > 1 ? 's' : ''}`}
                    </p>
                    {!isOpen && excerpt && (
                      <p className="mt-3 text-sm sm:text-base text-black/55 leading-relaxed line-clamp-2">
                        {excerpt}…
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-black/45 hover:text-black transition-colors">
                    {isOpen ? 'Close' : 'Read'}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.75, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-7 pb-8 border-t border-black/10 pt-6">
                        <div className="max-w-2xl space-y-6 text-base sm:text-lg leading-relaxed text-black/80">
                          {paragraphs.map((paragraph, index) => (
                            <p key={index} className="whitespace-pre-wrap">{paragraph}</p>
                          ))}
                        </div>

                        {blog.images?.length > 0 && (
                          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {blog.images.map((url, index) => (
                              <img
                                key={`${url}-${index}`}
                                src={mediaUrl(url)}
                                alt=""
                                loading="lazy"
                                className="w-full aspect-[4/3] object-cover border border-black/10"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPhotographs = () => (
    <div>
      <SectionHeading label="Photographs" index={currentIndex} total={NAV_ITEMS.length} count={content.photos.length} />
      {content.photos.length === 0 ? (
        <EmptyState message="The gallery walls are still empty." />
      ) : (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {content.photos.map((photo, index) => (
            <motion.button
              key={photo._id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.8, ease: EASE }}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative aspect-[4/5] overflow-hidden border border-black/15"
            >
              <img
                src={mediaUrl(photo.url)}
                alt={photo.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]"
              />
              <span className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-left text-[#F7F2E7] text-[10px] uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                {photo.title || 'View'}
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );

  const renderVideos = () => (
    <div>
      <SectionHeading label="Videos" index={currentIndex} total={NAV_ITEMS.length} count={content.videos.length} />
      {content.videos.length === 0 ? (
        <EmptyState message="Nothing is rolling yet." />
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {content.videos.map((video, index) => (
            <motion.button
              key={video._id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.08, 0.5), duration: 0.8, ease: EASE }}
              onClick={() => setSelectedVideo(video)}
              className="text-left border border-black/15 bg-black/[0.015] group"
            >
              <div className="relative aspect-video overflow-hidden bg-black">
                <video
                  src={mediaUrl(video.url)}
                  muted
                  preload="metadata"
                  playsInline
                  className="w-full h-full object-cover opacity-90 transition-opacity duration-500 group-hover:opacity-100"
                />
                <span className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-[#F7F2E7] text-[10px] tabular-nums">
                  {formatDuration(video.duration)}
                </span>
              </div>
              <div className="px-4 py-4">
                <h3 className="text-xl italic leading-tight">{video.title}</h3>
                <p className="mt-2 text-[9px] uppercase tracking-[0.35em] text-black/40">
                  {[video.location, formatDate(video.recordedAt || video.createdAt)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );

  const renderMusic = () => (
    <div style={{ '--primary': '0 0% 5%', '--primary-foreground': '36 40% 93%', '--muted-foreground': '0 0% 45%' }}>
      <SectionHeading label="Music" index={currentIndex} total={NAV_ITEMS.length} count={content.music.length} />
      {content.music.length === 0 ? (
        <EmptyState message="No sound has been recorded here yet." />
      ) : (
        <div className="mt-8 space-y-4">
          {content.music.map((track, index) => {
            const isActive = track._id === activeTrackId;
            return (
              <motion.div
                key={track._id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.08, 0.5), duration: 0.8, ease: EASE }}
                className="border border-black/15 bg-black/[0.015] p-4 sm:p-5"
              >
                {isActive ? (
                  <MusicPlayer
                    track={track}
                    restColor="rgba(11,11,11,0.22)"
                    playedColor={INK}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTrackId(track._id)}
                    className="w-full text-left flex items-baseline justify-between gap-4 group"
                  >
                    <div className="min-w-0">
                      <h3 className="text-xl sm:text-2xl italic truncate group-hover:text-black transition-colors text-black/80">
                        {track.title}
                      </h3>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.35em] text-black/40 truncate">
                        {[formatDate(track.madeAt || track.createdAt)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-[9px] uppercase tracking-[0.3em] text-black/45 group-hover:text-black transition-colors">
                      Play · {formatDuration(track.duration)}
                    </span>
                  </button>
                )}
              </motion.div>
            );
          })}
          {activeTrack && (
            <p className="text-[9px] uppercase tracking-[0.4em] text-black/35 pt-2">
              Select any track to play it with its notes
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (loadError) return <EmptyState message={loadError} />;
    if (active === 'blogs') return renderBlogs();
    if (active === 'photographs') return renderPhotographs();
    if (active === 'videos') return renderVideos();
    return renderMusic();
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE }}
        className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden"
        style={{ backgroundColor: CREAM, color: INK, fontFamily: "'Bodoni Moda', 'Times New Roman', serif" }}
      >
        {contactOpen && (
          <button
            type="button"
            aria-label="Close contact"
            onClick={() => setContactOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
        )}

        <header
          className="sticky top-0 z-30 border-b border-black/10"
          style={{ backgroundColor: 'rgba(247, 242, 231, 0.9)', backdropFilter: 'blur(10px)' }}
        >
          <div className="relative mx-auto w-full max-w-5xl px-6 sm:px-10 pt-10 sm:pt-14 pb-7">
            <div className="absolute right-6 sm:right-10 top-7 sm:top-9 z-40">
              <motion.button
                type="button"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.9, ease: EASE }}
                onClick={() => setContactOpen((open) => !open)}
                className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] pb-1 border-b border-transparent hover:border-current transition-colors duration-500"
              >
                {contactOpen ? 'Close' : 'Contact'}
              </motion.button>

              <AnimatePresence>
                {contactOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="absolute right-0 top-full mt-4 w-[min(21rem,calc(100vw-3rem))] border border-black/15 p-2"
                    style={{
                      backgroundColor: PANEL,
                      boxShadow: '0 30px 60px -30px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    <p className="px-3 pt-2 pb-3 text-[9px] uppercase tracking-[0.4em] text-black/40">
                      Get in touch
                    </p>
                    {CONTACTS.map((item) => (
                      <a
                        key={item.key}
                        href={item.href}
                        target={item.href.startsWith('http') ? '_blank' : undefined}
                        rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                        className="flex items-center gap-3 px-3 py-3 text-sm text-black/75 hover:text-black hover:bg-black/[0.04] transition-colors duration-300"
                      >
                        <item.icon className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="truncate">{item.label}</span>
                      </a>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="text-center">
              <h1 className="flex justify-center overflow-hidden text-[16vw] sm:text-8xl lg:text-9xl leading-[0.95] tracking-[-0.02em]">
                {TITLE.map((char, index) => (
                  <motion.span
                    key={`${char}-${index}`}
                    initial={{ y: '110%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    transition={{ delay: 0.2 + index * 0.07, duration: 1.1, ease: EASE }}
                    className="inline-block"
                  >
                    {char}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 1, ease: EASE }}
                className="mt-4 text-[9px] sm:text-[10px] uppercase tracking-[0.5em] text-black/45"
              >
                Art · Words · Sound
              </motion.p>

              <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-12">
                {NAV_ITEMS.map((item, index) => (
                  <motion.button
                    key={item.key}
                    type="button"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.05 + index * 0.1, duration: 0.9, ease: EASE }}
                    onClick={() => setActive(item.key)}
                    className={`relative pb-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] transition-colors duration-500 ${
                      active === item.key ? 'text-black' : 'text-black/45 hover:text-black/80'
                    }`}
                  >
                    {item.label}
                    {active === item.key && (
                      <motion.span
                        layoutId="sid-art-nav-underline"
                        className="absolute inset-x-0 bottom-0 h-px bg-current"
                        transition={{ duration: 0.6, ease: EASE }}
                      />
                    )}
                  </motion.button>
                ))}
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-6 sm:px-10 pt-14 sm:pt-20 pb-24 min-h-[50vh]">
          <AnimatePresence mode="wait">
            <motion.section
              key={active}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              {renderContent()}
            </motion.section>
          </AnimatePresence>
        </main>

        <footer className="border-t border-black/10">
          <div className="mx-auto w-full max-w-5xl px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[9px] sm:text-[10px] uppercase tracking-[0.4em] text-black/45">
            <span>Sid-Art</span>
            <span>© 2026 — All works are original</span>
          </div>
        </footer>

        <AnimatePresence>
          {selectedPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              onClick={() => setSelectedPhoto(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
              style={{ backgroundColor: 'rgba(11, 11, 11, 0.92)', backdropFilter: 'blur(6px)' }}
            >
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-5 right-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#F7F2E7]/80 hover:text-[#F7F2E7] transition-colors"
              >
                <X className="w-4 h-4" />
                Close
              </button>

              <motion.figure
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.6, ease: EASE }}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-4xl max-h-full overflow-y-auto"
              >
                <img
                  src={mediaUrl(selectedPhoto.url)}
                  alt={selectedPhoto.title}
                  className="w-full max-h-[60vh] object-contain"
                />
                <figcaption className="mt-5 text-[#F7F2E7]">
                  <h3 className="text-2xl sm:text-3xl italic">{selectedPhoto.title}</h3>
                  {selectedPhoto.description && (
                    <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-[#F7F2E7]/75">
                      {selectedPhoto.description}
                    </p>
                  )}
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[#F7F2E7]/70">
                    <MetaRow icon={CalendarDays}>
                      {formatDate(selectedPhoto.takenAt || selectedPhoto.createdAt, true)}
                    </MetaRow>
                    <MetaRow icon={MapPin}>{selectedPhoto.location}</MetaRow>
                    <MetaRow icon={Camera}>{selectedPhoto.camera}</MetaRow>
                  </div>
                  {selectedPhoto.width > 0 && (
                    <p className="mt-4 text-[9px] uppercase tracking-[0.35em] text-[#F7F2E7]/45">
                      {selectedPhoto.width} × {selectedPhoto.height} px
                      {selectedPhoto.source === 'blog' ? ' · published with a blog' : ''}
                    </p>
                  )}
                </figcaption>
              </motion.figure>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedVideo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              onClick={() => setSelectedVideo(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
              style={{ backgroundColor: 'rgba(11, 11, 11, 0.94)', backdropFilter: 'blur(6px)' }}
            >
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="absolute top-5 right-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#F7F2E7]/80 hover:text-[#F7F2E7] transition-colors"
              >
                <X className="w-4 h-4" />
                Close
              </button>

              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.6, ease: EASE }}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-4xl max-h-full overflow-y-auto"
              >
                <video
                  src={mediaUrl(selectedVideo.url)}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[60vh] bg-black"
                />
                <div className="mt-5 text-[#F7F2E7]">
                  <h3 className="text-2xl sm:text-3xl italic">{selectedVideo.title}</h3>
                  {selectedVideo.description && (
                    <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-[#F7F2E7]/75">
                      {selectedVideo.description}
                    </p>
                  )}
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[#F7F2E7]/70">
                    <MetaRow icon={CalendarDays}>
                      {formatDate(selectedVideo.recordedAt || selectedVideo.createdAt, true)}
                    </MetaRow>
                    <MetaRow icon={MapPin}>{selectedVideo.location}</MetaRow>
                    <MetaRow icon={Clapperboard}>{formatDuration(selectedVideo.duration)}</MetaRow>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
};

export default SidArt;
