const fs = require('fs/promises');
const path = require('path');
const { find, findOne, insert, findAndDelete, updateById } = require('../db/helpers');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'art');
const PUBLIC_PREFIX = '/uploads/art/';

const toUrl = (dir, filename) => `${PUBLIC_PREFIX}${dir}/${filename}`;

const parseJson = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const baseName = (name = '') => name.replace(/\.[^.]+$/, '');

const removeFile = async (publicPath) => {
  if (typeof publicPath !== 'string' || !publicPath.startsWith(PUBLIC_PREFIX)) return;
  const relative = publicPath.slice(PUBLIC_PREFIX.length);
  const target = path.resolve(UPLOAD_ROOT, relative);
  if (!target.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) return;
  try {
    await fs.unlink(target);
  } catch (error) {
    // The file may already be gone.
  }
};

const fail = (res, error) => {
  if (error.name === 'CastError') {
    return res.status(404).json({ message: 'Not found' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: error.message });
  }
  return res.status(500).json({ message: error.message });
};

// Creates land in the caller's partition; public/owner reads see only
// non-guest art (guestSession: null), guests see only their own session.
const guestSession = (req) => (req.dataScope ? req.dataScope.guestSession : null);

// Read scope keeps each profile's art private: an authenticated caller sees
// only their own partition (their guests see only their session's copies).
// Anonymous reads power the public Sid-Art showcase and resolve to the single
// showcase profile — the other profile's work never appears in public.
let showcaseCache = { id: null, at: 0 };
const SHOWCASE_TTL_MS = 60000;

const getShowcaseUserId = () => {
  if (showcaseCache.id && Date.now() - showcaseCache.at < SHOWCASE_TTL_MS) return showcaseCache.id;
  const showcase = findOne('users', { showcase: true });
  const owner = showcase || find('users', {}, { orderBy: '"createdAt" ASC', limit: 1 })[0] || null;
  showcaseCache = { id: owner ? owner._id : null, at: Date.now() };
  return showcaseCache.id;
};

const artScope = async (req) => {
  const scopedUser = req.dataScope ? req.dataScope.user : null;
  if (scopedUser) {
    return { user: scopedUser, guestSession: guestSession(req) };
  }
  const showcaseId = getShowcaseUserId();
  return showcaseId ? { user: showcaseId, guestSession: null } : { guestSession: null };
};

exports.createBlog = async (req, res) => {
  try {
    const files = req.files || [];
    const meta = parseJson(req.body.imageMeta, []);
    const blog = insert('art_blogs', {
      user: req.user._id,
      guestSession: guestSession(req),
      title: (req.body.title || '').trim() || 'Untitled',
      content: req.body.content || '',
      images: files.map((file) => toUrl('images', file.filename)),
    });

    files.forEach((file, index) => {
      const info = meta[index] || {};
      insert('art_photos', {
        user: req.user._id,
        guestSession: guestSession(req),
        title: info.title || baseName(file.originalname),
        description: info.description || '',
        location: info.location || '',
        takenAt: toDate(info.takenAt),
        camera: info.camera || '',
        url: toUrl('images', file.filename),
        name: file.originalname,
        size: file.size,
        width: info.width || 0,
        height: info.height || 0,
        source: 'blog',
        blog: blog._id,
      });
    });

    res.status(201).json(blog);
  } catch (error) {
    fail(res, error);
  }
};

exports.createPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' });
    const photo = insert('art_photos', {
      user: req.user._id,
      guestSession: guestSession(req),
      title: (req.body.title || '').trim() || baseName(req.file.originalname),
      description: req.body.description || '',
      location: req.body.location || '',
      takenAt: toDate(req.body.takenAt),
      camera: req.body.camera || '',
      url: toUrl('images', req.file.filename),
      name: req.file.originalname,
      size: req.file.size,
      width: Number(req.body.width) || 0,
      height: Number(req.body.height) || 0,
      source: 'upload',
    });
    res.status(201).json(photo);
  } catch (error) {
    fail(res, error);
  }
};

exports.createVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a video to upload' });
    const video = insert('art_videos', {
      user: req.user._id,
      guestSession: guestSession(req),
      title: (req.body.title || '').trim() || baseName(req.file.originalname),
      description: req.body.description || '',
      location: req.body.location || '',
      recordedAt: toDate(req.body.recordedAt),
      url: toUrl('videos', req.file.filename),
      name: req.file.originalname,
      size: req.file.size,
      duration: Number(req.body.duration) || 0,
      width: Number(req.body.width) || 0,
      height: Number(req.body.height) || 0,
    });
    res.status(201).json(video);
  } catch (error) {
    fail(res, error);
  }
};

exports.createMusic = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose an audio file to upload' });
    const music = insert('art_music', {
      user: req.user._id,
      guestSession: guestSession(req),
      title: (req.body.title || '').trim() || baseName(req.file.originalname),
      description: req.body.description || '',
      madeAt: toDate(req.body.madeAt),
      url: toUrl('music', req.file.filename),
      name: req.file.originalname,
      size: req.file.size,
      duration: Number(req.body.duration) || 0,
      peaks: parseJson(req.body.peaks, []),
    });
    res.status(201).json(music);
  } catch (error) {
    fail(res, error);
  }
};

exports.getBlogs = async (req, res) => {
  try {
    const blogs = find('art_blogs', await artScope(req), { orderBy: '"createdAt" DESC' });
    res.json(blogs);
  } catch (error) {
    fail(res, error);
  }
};

exports.getBlog = async (req, res) => {
  try {
    const blog = findOne('art_blogs', { _id: req.params.id, ...(await artScope(req)) });
    if (!blog) return res.status(404).json({ message: 'Post not found' });
    res.json(blog);
  } catch (error) {
    fail(res, error);
  }
};

exports.getPhotos = async (req, res) => {
  try {
    const photos = find('art_photos', await artScope(req), {
      orderBy: '"takenAt" DESC, "createdAt" DESC',
    });
    res.json(photos);
  } catch (error) {
    fail(res, error);
  }
};

exports.getVideos = async (req, res) => {
  try {
    const videos = find('art_videos', await artScope(req), {
      orderBy: '"recordedAt" DESC, "createdAt" DESC',
    });
    res.json(videos);
  } catch (error) {
    fail(res, error);
  }
};

exports.getMusic = async (req, res) => {
  try {
    const tracks = find('art_music', await artScope(req), {
      orderBy: '"madeAt" DESC, "createdAt" DESC',
    });
    res.json(tracks);
  } catch (error) {
    fail(res, error);
  }
};

const TABLES = {
  blogs: 'art_blogs',
  photos: 'art_photos',
  videos: 'art_videos',
  music: 'art_music',
};

exports.deleteArt = async (req, res) => {
  try {
    const table = TABLES[req.params.type];
    if (!table) return res.status(400).json({ message: 'Unknown art type' });

    const item = findAndDelete(table, {
      _id: req.params.id,
      user: req.dataScope.user,
      guestSession: req.dataScope.guestSession,
    });
    if (!item) return res.status(404).json({ message: 'Not found' });

    if (item.source === 'blog' && item.blog) {
      // $pull parity: drop this image from the blog's gallery.
      const blog = findOne('art_blogs', {
        _id: item.blog,
        user: req.dataScope.user,
        guestSession: req.dataScope.guestSession,
      });
      if (blog && Array.isArray(blog.images) && blog.images.includes(item.url)) {
        updateById('art_blogs', blog._id, {
          images: blog.images.filter((url) => url !== item.url),
        });
      }
    }

    // A shared copy points at the owner's media — only the doc goes away.
    if (!item.sharedCopy) {
      const files = [item.url, ...(item.images || [])];
      await Promise.all(files.map(removeFile));
    }

    res.json({ message: 'Deleted' });
  } catch (error) {
    fail(res, error);
  }
};
