const { initializeApp } = require("firebase/app");  // Client SDK
const { getAuth } = require("firebase/auth");  // Client SDK
const { getFirestore } = require("firebase/firestore");  // Client SDK
const admin = require('firebase-admin');  // Admin SDK
const path = require('path');
const { getStorage, ref, getDownloadURL, uploadBytesResumable } = require("firebase/storage");


const firebaseConfig = {
    apiKey: process.env.APIKEY,
    authDomain: process.env.AUTHDOMAIN,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGING_SENDER_ID,
    appId: process.env.APP_ID
  };

const serviceAccount = require(path.join(__dirname, '../firebase/serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.STORAGE_BUCKET,
});
const bucket = admin.storage().bucket();

const apps = initializeApp(firebaseConfig);
const auth = getAuth(apps);
const db = getFirestore(apps);

module.exports = { auth, db, bucket, apps };
