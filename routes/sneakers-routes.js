const express = require('express');
const { check } = require('express-validator');

const sneakersControllers = require('../controllers/sneakers-controllers');
const fileUpload = require('../middleware/file-upload');
const checkAuth = require('../middleware/check-auth');

const router = express.Router();

router.get('/:pid', sneakersControllers.getSneakerById);

router.get('/user/:uid', sneakersControllers.getSneakersByUserId);

router.use(checkAuth);

router.post(
  "/",
  fileUpload.single("image"),
  [
    check("title").not().isEmpty(),
    check("description").isLength({ min: 5 }),
    check("address").not().isEmpty(),
    check("url").not().isEmpty(),
  ],
  sneakersControllers.createSneaker
);

router.patch(
  '/:pid',
  [
    check('title')
      .not()
      .isEmpty(),
    check('description').isLength({ min: 5 })
  ],
  sneakersControllers.updateSneaker
);

router.delete('/:pid', sneakersControllers.deleteSneaker);

module.exports = router;
