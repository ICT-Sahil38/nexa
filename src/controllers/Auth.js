const express = require("express");
const routes = express.Router();

const AuthModel = require("firebase/auth");
const { auth } = require("../../firebase/firebase");

routes.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const userCredential = await AuthModel.signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    res.status(200).json({ message: "Login successful", uid: user.uid });
  } catch (error) {
    res.status(400).send(error.message);
  }
};

routes.registration = async (req, res) => {
  const { email, password } = req.body;
  try {
    const userCredential = await AuthModel.createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;
    res
      .status(201)
      .json({ message: "User registered successfully", uid: user.uid });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
module.exports = routes;
