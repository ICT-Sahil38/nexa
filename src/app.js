const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const app = express();
require("dotenv").config({ path: '../.env' });

const mainRoute = require("./routes");
app.use(bodyParser.urlencoded({ extended: false, limit: "100mb" }));
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: false }));

app.use(function logger(req, res, next) {
  console.log(new Date(), req.method, req.url);
  return next();
});

app.use(mainRoute);

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server Started At localhost:${process.env.PORT || 5000}`);
});
