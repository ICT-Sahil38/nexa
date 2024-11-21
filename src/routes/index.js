const express = require("express");
const routes = express.Router();
const { auth, db, bucket } = require("../../firebase/firebase");
const multer = require("multer");
const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
} = require("firebase/storage");
const fs = require("fs");
const { log } = require("console");
const { createUserWithEmailAndPassword, signInWithEmailAndPassword, } = require("firebase/auth");
const fileUpload = require("express-fileupload");
const pdf = require("pdf-parse");
const path = require("path");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const AuthController = require("../controllers/Auth");
const FilesController = require("../controllers/Files");

// Login Route (Authentication example)
routes.post("/login", AuthController.login);
routes.post("/registration", AuthController.registration);

routes.post('/upload/:userId',upload.single('file'),FilesController.uploadPost);
routes.get('/getdata/:userId',FilesController.getData);
routes.get('/analyze/:userId',FilesController.analyzeData);
routes.get('/analyzeLink/:userId',FilesController.analyzeLink);


module.exports = routes;

