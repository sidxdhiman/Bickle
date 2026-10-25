const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { makeUpload } = require('../middleware/artUpload');
const {
  createBlog, createPhoto, createVideo, createMusic,
  getBlogs, getBlog, getPhotos, getVideos, getMusic,
  deleteArt,
} = require('../controllers/artController');

const imageUpload = makeUpload('images');
const videoUpload = makeUpload('videos');
const musicUpload = makeUpload('music');

// Public reads power the Sid-Art showcase site.
router.get('/blogs', getBlogs);
router.get('/blogs/:id', getBlog);
router.get('/photos', getPhotos);
router.get('/videos', getVideos);
router.get('/music', getMusic);

router.post('/blogs', protect, imageUpload.array('images', 16), createBlog);
router.post('/photos', protect, imageUpload.single('file'), createPhoto);
router.post('/videos', protect, videoUpload.single('file'), createVideo);
router.post('/music', protect, musicUpload.single('file'), createMusic);

router.delete('/:type/:id', protect, deleteArt);

module.exports = router;
