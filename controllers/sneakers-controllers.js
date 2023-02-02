const fs = require("fs");

const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Sneaker = require("../models/sneaker");
const User = require("../models/user");

const getSneakerById = async (req, res, next) => {
  const sneakerId = req.params.pid;

  let sneaker;
  try {
    sneaker = await Sneaker.findById(sneakerId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find a sneaker.",
      500
    );
    return next(error);
  }

  if (!sneaker) {
    const error = new HttpError(
      "Could not find sneaker for the provided id.",
      404
    );
    return next(error);
  }

  res.json({ sneaker: sneaker.toObject({ getters: true }) });
};

const getSneakersByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  // let sneakers;
  let userWithSneakers;
  try {
    userWithSneakers = await User.findById(userId).populate("sneakers");
  } catch (err) {
    const error = new HttpError(
      "Fetching sneakers failed, please try again later.",
      500
    );
    return next(error);
  }

  // if (!sneakers || sneakers.length === 0) {
  if (!userWithSneakers || userWithSneakers.sneakers.length === 0) {
    return next(
      new HttpError("Could not find sneakers for the provided user id.", 404)
    );
  }

  res.json({
    sneakers: userWithSneakers.sneakers.map((sneaker) =>
      sneaker.toObject({ getters: true })
    ),
  });
};

const createSneaker = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { title, description, address, url } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdSneaker = new Sneaker({
    title,
    description,
    address,
    url,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  console.log("sneaker created: ", createdSneaker);

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Creating sneaker failed, please try again.",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id.", 404);
    return next(error);
  }

  console.log(user);

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdSneaker.save({ session: sess });
    user.sneakers.push(createdSneaker);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Creating sneaker failed, please try again.",
      500
    );
    return next(error);
  }

  res.status(201).json({ sneaker: createdSneaker });
};

const updateSneaker = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { title, description } = req.body;
  const sneakerId = req.params.pid;

  let sneaker;
  try {
    sneaker = await Sneaker.findById(sneakerId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not update sneaker.",
      500
    );
    return next(error);
  }

  if (sneaker.creator.toString() !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to edit this sneaker.",
      401
    );
    return next(error);
  }

  sneaker.title = title;
  sneaker.description = description;

  try {
    await sneaker.save();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not update sneaker.",
      500
    );
    return next(error);
  }

  res.status(200).json({ sneaker: sneaker.toObject({ getters: true }) });
};

const deleteSneaker = async (req, res, next) => {
  const sneakerId = req.params.pid;

  let sneaker;
  try {
    sneaker = await Sneaker.findById(sneakerId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete sneaker.",
      500
    );
    return next(error);
  }

  if (!sneaker) {
    const error = new HttpError("Could not find sneaker for this id.", 404);
    return next(error);
  }

  if (sneaker.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to delete this sneaker.",
      401
    );
    return next(error);
  }

  const imagePath = sneaker.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await sneaker.remove({ session: sess });
    sneaker.creator.sneakers.pull(sneaker);
    await sneaker.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete sneaker.",
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted sneaker." });
};

exports.getSneakerById = getSneakerById;
exports.getSneakersByUserId = getSneakersByUserId;
exports.createSneaker = createSneaker;
exports.updateSneaker = updateSneaker;
exports.deleteSneaker = deleteSneaker;
