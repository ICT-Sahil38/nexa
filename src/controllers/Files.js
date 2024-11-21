const express = require("express");
const routes = express.Router();
const Multer = require("multer");
const path = require("path");
const pdfParse = require("pdf-parse"); // Import pdf-parse
const fetch = require("node-fetch");
const { getStorage, ref, getDownloadURL, uploadBytesResumable } = require("firebase/storage");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require(path.join(__dirname, "../../firebase/serviceAccountKey.json"));
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const tmp = require("tmp-promise");
const { console } = require("inspector");
const { log } = require("console");
const { PDFImage } = require("pdf-image");
const cheerio = require("cheerio");

// Firebase admin initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.STOREGE_BUCKET
  });
}

const db = getFirestore();
const cloudStorage = getStorage();
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

// Multer configuration for file upload
const upload = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// Upload Route
routes.uploadPost = async (req, res) => {
  try {
    const userId = req.params.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Please upload a valid file" });
    }

    // Define file size limits
    const maxPdfSize = 10 * 1024 * 1024;
    const maxImageSize = 5 * 1024 * 1024;

    // Determine file type and Firebase paths
    let storagePath, collectionName;
    if (file.mimetype === "application/pdf") {
      if (file.size > maxPdfSize) {
        return res.status(400).json({ message: "PDF size should not exceed 10MB" });
      }
      storagePath = `usersPdf/${file.originalname}`;
      collectionName = "files";
    } else if (file.mimetype.startsWith("image/")) {
      if (file.size > maxImageSize) {
        return res.status(400).json({ message: "Image size should not exceed 5MB" });
      }
      storagePath = `usersImages/${file.originalname}`;
      collectionName = "images";
    } else if (file.mimetype === "application/json") {
      storagePath = `usersPrompts/${file.originalname}`;
      collectionName = "prompts";
    } else {
      return res.status(400).json({ message: "Please upload a valid PDF, image, or JSON file" });
    }

    // Firebase Storage reference and metadata
    const storageRef = ref(cloudStorage, storagePath);
    const metadata = { contentType: file.mimetype };

    // Upload file to Firebase Storage
    const snapshot = await uploadBytesResumable(storageRef, file.buffer, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // File metadata for Firestore
    const fileData = {
      originalname: file.originalname,
      createdAt: new Date(),
      path: snapshot.ref.fullPath,
      uploadedBy: userId,
      downloadURL: downloadURL,
    };

    // Save metadata in Firestore under specific userId and collection
    await db.collection("uploads").doc(userId).collection(collectionName).add(fileData);

    // Return response
    res.status(200).json({
      message: `${file.mimetype.startsWith("image/") ? "Image" : "PDF"} uploaded successfully`,
      downloadURL: downloadURL,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({
      message: "An error occurred during file upload",
      error: error.message,
    });
  }
};



routes.getData = async(req,res)=>{
  try{
    const userId = req.params.userId;

    const filesSnapshot = await db.collection('uploads')
                                  .doc(userId)
                                  .collection('files')
                                  .get();

    if (filesSnapshot.empty) {
      console.log('No files found for this userId.');
      return { message: "No files found" };
    }

    // Array to hold all file documents and their subcollections data
    const filesData = [];

    for (const fileDoc of filesSnapshot.docs) {
      // Get the main document data
      const fileData = fileDoc.data();

      // Get all nested subcollections inside this file document
      const subCollections = await fileDoc.ref.listCollections();
      const subCollectionsData = {};

      // Fetch each subcollection's documents
      for (const subCollection of subCollections) {
        const subCollectionSnapshot = await subCollection.get();
        subCollectionsData[subCollection.id] = subCollectionSnapshot.docs.map(doc => doc.data());
      }

      // Combine file data and subcollections data
      filesData.push({
        fileData,
        // subCollections: subCollectionsData
      });
    }

    // Return the data as JSON
    // return { files: filesData };
    res.status(200).json({
      files:filesData
    })
    
    // for (const doc of fileData.docs) {
    //   // const subCollections = await doc.ref.listCollections();
    //   // log(subCollections)
    //   const { path: storagePath } = doc.data();
    //   log(storagePath)
    //   const pdfPath = await downloadPdfFromStorage(storagePath);
    //   const { text, images } = await extractPdfContent(pdfPath);
    //   console.log(text, images);
    //   const llamaOutput = await generateLlamaResponse(text);
    //   res.status(200).json({
    //     message: "File processed successfully",
    //     extractedText: text,
    //     images,
    //     llamaOutput,
    //   });
    // }

  }catch (error) {
    console.error("Error :", error);
    res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
}

routes.analyzeData = async (req, res) => {
  const { link } = req.body;
  const userId = req.params.userId;
  const promptContent = await extractPdfContentFromLink(link);
  var content_to_send = promptContent.text + "\nSummarise the above content. Keep everything under 200 words , and generate some questions from this each in next line. remove all special characters."
  const llamaResponse = await generateLlamaResponse(content_to_send);
  res.json({ llamaResponse });
};

routes.analyzeLink = async (req, res) => {
  try {
    const { link } = req.body;
    log(link);
    if (!link || !link.startsWith("http")) {
      return res.status(400).json({ message: "Invalid link provided" });
    }

    const extractedText = await extractTextFromGoogleLink(link);

    const llamaResponse = await generateLlamaResponse(extractedText + "Dont repeat the prompt just summerize this in 100 words");

    res.status(200).json({
      message: "Link analyzed successfully",
      llamaResponse,
    });
  } catch (error) {
    console.error("Error analyzing link:", error);
    res.status(500).json({ message: "An error occurred", error: error.message });
  }
};


async function generateLlamaResponse(promptContent) {
  const input = `Based on the following prompt data, generate a response: ${JSON.stringify(promptContent)}`;

  const response = await fetch("https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-11B-Vision-instruct", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs:input,
      parameters:{
        max_new_tokens: 1024,
        return_full_text: true
      },
    }),
  });

  const result = await response.json();
  // console.log(result);
  return result[0]?.generated_text || "No response generated";
}
// async function downloadPdfFromStorage(storageRefPath) {
//   const url = await getDownloadURL(ref(cloudStorage, storageRefPath));
//   const response = await fetch(url);
//   const buffer = await response.buffer();

//   const tmpFile = await tmp.file({ postfix: ".pdf" });
//   fs.writeFileSync(tmpFile.path, buffer);
//   console.log("This is file path ",tmpFile.path);

//   return tmpFile.path;
// }
async function extractPdfContentFromLink(downloadLink) {
  try {
    const pdfBuffer = await downloadPdf(downloadLink);

    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const images = [];

    for (const page of pdfDoc.getPages()) {
      const imagesOnPage = page.node.Resources?.XObject?.entries() || [];
      for (const [key, xObject] of imagesOnPage) {
        if (xObject instanceof PDFImage) {
          const imageData = await xObject.getBytes();
          images.push({
            key,
            width: xObject.width,
            height: xObject.height,
            data: imageData.toString("base64"),
          });
        }
      }
    }

    return { text, images };
  } catch (error) {
    console.error("Error extracting PDF content:", error);
    return null;
  }
}
async function downloadPdf(downloadLink) {
  const response = await fetch(downloadLink);
  if (!response.ok) throw new Error("Failed to download PDF");
  return await response.buffer();
}

// async function extractImagesFromPDF(pdfBuffer) {
//   log("Here in extractImagesFromPDF")
//   const tmpFilePath = await tmpFileFromBuffer(pdfBuffer);
//   log("further")

//   const pdfImage = new PDFImage(tmpFilePath);
//   log("pdfImage")
//   const imagePaths = await pdfImage.convertFile();
//   log("imagePaths")

  
//   // Read images as base64
//   const images = imagePaths.map((path) => {
//     const imageData = fs.readFileSync(path, { encoding: "base64" });
//     log("-------------------")
//     fs.unlinkSync(path);  // Clean up each temp image file after reading
//     // return imageData;
//     log("unsync path")
//   });

//   fs.unlinkSync(tmpFilePath);
//     // Clean up the temporary PDF file
//   log("returning images");

//   return images;
// }
// async function tmpFileFromBuffer(buffer) {
//   const tmpFile = await tmp.file({ postfix: ".pdf" });
//   fs.writeFileSync(tmpFile.path, buffer);
//   log("tmp fnc over")
//   return tmpFile.path;
// }

async function extractTextFromGoogleLink(link) {
  try {
    const response = await fetch(link);
    if (!response.ok) throw new Error("Failed to fetch the link");

    const htmlContent = await response.text();

    const $ = cheerio.load(htmlContent);
    const textContent = $("body")
      .find("p, h1, h2, h3, h4, h5, h6, li, span")
      .map((_, el) => $(el).text())
      .get()
      .join(" ");

    const cleanedText = textContent
      .replace(/\s+/g, " ")
      .trim();
    return cleanedText || "No text content extracted from the link.";
  } catch (error) {
    console.error("Error extracting text from link:", error);
    throw new Error("Unable to extract text from the link");
  }
}
module.exports = routes;
