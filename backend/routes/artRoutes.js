const express = require('express');
const router = express.Router();
const { protect, denyRestrictedAccount } = require('../middleware/auth');
const { optionalScope } = require('../middleware/scope');
const { makeUpload } = require('../middleware/artUpload');
const {
  createBlog, createPhoto, createVideo, createMusic,
  getBlogs, getBlog, getPhotos, getVideos, getMusic,
  deleteArt,
} = require('../controllers/artController');

const imageUpload = makeUpload('images');
const videoUpload = makeUpload('videos');
const musicUpload = makeUpload('music');

// The whole module — uploads and reads alike — stays out of first-boot
// signup accounts; only the seeded profiles and profiles created inside the
// app may use it. Anonymous visitors still reach the public showcase below.
const denyRestrictedArt = (req, res, next) =>
  denyRestrictedAccount(req, res, 'Art') ? undefined : next();

// Public reads power the Sid-Art showcase site. optionalScope partitions them:
// logged-in profiles see only their own art, guests only their session's
// copies, and anonymous visitors only the showcase profile's work.
router.get('/blogs', optionalScope, denyRestrictedArt, getBlogs);
router.get('/blogs/:id', optionalScope, denyRestrictedArt, getBlog);
router.get('/photos', optionalScope, denyRestrictedArt, getPhotos);
router.get('/videos', optionalScope, denyRestrictedArt, getVideos);
router.get('/music', optionalScope, denyRestrictedArt, getMusic);

router.post('/blogs', protect, denyRestrictedArt, imageUpload.array('images', 16), createBlog);
router.post('/photos', protect, denyRestrictedArt, imageUpload.single('file'), createPhoto);
router.post('/videos', protect, denyRestrictedArt, videoUpload.single('file'), createVideo);
router.post('/music', protect, denyRestrictedArt, musicUpload.single('file'), createMusic);

router.delete('/:type/:id', protect, denyRestrictedArt, deleteArt);

module.exports = router;
