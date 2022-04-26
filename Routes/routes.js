const privateRoutes = require('./private.js');
const publicRoutes = require('./public.js');
const router = require('express').Router();


router.use('/private', privateRoutes);
router.use('/public', publicRoutes);

module.exports = router;