import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Phone, Mail, Linkedin, Github } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];
const CREAM = '#F7F2E7';
const PANEL = '#FBF7EE';
const INK = '#0B0B0B';

const TITLE = 'Sid-Art'.split('');

const NAV_ITEMS = [
  {
    key: 'blogs',
    label: 'Blogs',
    line: 'Essays, notes and quiet thoughts, written slowly.',
  },
  {
    key: 'photographs',
    label: 'Photographs',
    line: 'Frames worth keeping, held a little longer.',
  },
  {
    key: 'videos',
    label: 'Videos',
    line: 'Moving pictures, never in a hurry.',
  },
  {
    key: 'music',
    label: 'Music',
    line: 'Sounds from the room, played softly.',
  },
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

const SidArt = () => {
  const [active, setActive] = useState(NAV_ITEMS[0].key);
  const [contactOpen, setContactOpen] = useState(false);

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

  const current = NAV_ITEMS.find((item) => item.key === active) || NAV_ITEMS[0];
  const currentIndex = NAV_ITEMS.findIndex((item) => item.key === current.key) + 1;

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

        <main className="mx-auto w-full max-w-5xl px-6 sm:px-10 pt-14 sm:pt-20 pb-24">
          <AnimatePresence mode="wait">
            <motion.section
              key={current.key}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <div className="flex items-baseline justify-between gap-6 border-b border-black/15 pb-5">
                <h2 className="text-3xl sm:text-5xl italic tracking-[-0.01em]">{current.label}</h2>
                <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.4em] text-black/40">
                  {String(currentIndex).padStart(2, '0')} / {String(NAV_ITEMS.length).padStart(2, '0')}
                </span>
              </div>

              <p className="mt-8 max-w-2xl text-lg sm:text-2xl leading-relaxed text-black/70">
                {current.line}
              </p>

              <div className="mt-14 border border-black/15 px-6 py-20 sm:py-28 text-center">
                <div className="mx-auto h-px w-16 bg-black/20" />
                <p className="mt-8 text-xl sm:text-3xl italic text-black/75">
                  This corner of the studio is still being arranged.
                </p>
                <p className="mt-6 text-[9px] sm:text-[10px] uppercase tracking-[0.45em] text-black/40">
                  Coming soon
                </p>
                <div className="mx-auto mt-8 h-px w-16 bg-black/20" />
              </div>
            </motion.section>
          </AnimatePresence>
        </main>

        <footer className="border-t border-black/10">
          <div className="mx-auto w-full max-w-5xl px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[9px] sm:text-[10px] uppercase tracking-[0.4em] text-black/45">
            <span>Sid-Art</span>
            <span>© 2026 — All works are original</span>
          </div>
        </footer>
      </motion.div>
    </MotionConfig>
  );
};

export default SidArt;
