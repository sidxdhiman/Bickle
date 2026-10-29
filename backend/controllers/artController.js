const fs = require('fs/promises');
const path = require('path');
const ArtBlog = require('../models/ArtBlog');
const ArtPhoto = require('../models/ArtPhoto');
const ArtVideo = require('../models/ArtVideo');
const ArtMusic = require('../models/ArtMusic');

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
const readScope = (req) => ({ guestSession: guestSession(req) });

exports.createBlog = async (req, res) => {
  try {
    const files = req.files || [];
    const meta = parseJson(req.body.imageMeta, []);
    const blog = await ArtBlog.create({
      user: req.user._id,
      guestSession: guestSession(req),
      title: (req.body.title || '').trim() || 'Untitled',
      content: req.body.content || '',
      images: files.map((file) => toUrl('images', file.filename)),
    });

    await Promise.all(files.map((file, index) => {
      const info = meta[index] || {};
      return ArtPhoto.create({
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
    }));

    res.status(201).json(blog);
  } catch (error) {
    fail(res, error);
  }
};

exports.createPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' });
    const photo = await ArtPhoto.create({
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
    const video = await ArtVideo.create({
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
    const music = await ArtMusic.create({
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
    const blogs = await ArtBlog.find(readScope(req)).sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    fail(res, error);
  }
};

exports.getBlog = async (req, res) => {
  try {
    const blog = await ArtBlog.findOne({ _id: req.params.id, ...readScope(req) });
    if (!blog) return res.status(404).json({ message: 'Post not found' });
    res.json(blog);
  } catch (error) {
    fail(res, error);
  }
};

exports.getPhotos = async (req, res) => {
  try {
    const photos = await ArtPhoto.find(readScope(req)).sort({ takenAt: -1, createdAt: -1 });
    res.json(photos);
  } catch (error) {
    fail(res, error);
  }
};

exports.getVideos = async (req, res) => {
  try {
    const videos = await ArtVideo.find(readScope(req)).sort({ recordedAt: -1, createdAt: -1 });
    res.json(videos);
  } catch (error) {
    fail(res, error);
  }
};

exports.getMusic = async (req, res) => {
  try {
    const tracks = await ArtMusic.find(readScope(req)).sort({ madeAt: -1, createdAt: -1 });
    res.json(tracks);
  } catch (error) {
    fail(res, error);
  }
};

const MODELS = {
  blogs: ArtBlog,
  photos: ArtPhoto,
  videos: ArtVideo,
  music: ArtMusic,
};

exports.deleteArt = async (req, res) => {
  try {
    const Model = MODELS[req.params.type];
    if (!Model) return res.status(400).json({ message: 'Unknown art type' });

    const item = await Model.findOneAndDelete({
      _id: req.params.id,
      user: req.dataScope.user,
      guestSession: req.dataScope.guestSession,
    });
    if (!item) return res.status(404).json({ message: 'Not found' });

    if (item.source === 'blog' && item.blog) {
      await ArtBlog.updateOne(
        { _id: item.blog, user: req.dataScope.user, guestSession: req.dataScope.guestSession },
        { $pull: { images: item.url } }
      );
    }

    const files = [item.url, ...(item.images || [])];
    await Promise.all(files.map(removeFile));

    res.json({ message: 'Deleted' });
  } catch (error) {
    fail(res, error);
  }
};
