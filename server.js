require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const {connectMongoDB} = require("./config/dbConn");
const corsOptions = require("./config/corsOptions");
const credentials = require("./middleware/credentials");
const verifyJWT = require("./middleware/verifyJWT");
const { logger } = require("./middleware/logEvents");
const bodyParser = require("body-parser");
const https = require("https");
const path = require("path");
const fs = require("fs");
const app = express();
const compression = require("compression");
// const http = require("http");

// limit to 10 MB
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));

// custom middleware logger
app.use(logger);

// Handle options credentials check - before cors
// and fetch cookies credentials requirement
app.use(credentials);

//  CORS configuration
app.use(cors(corsOptions));

// app.use(express.urlencoded({ extended: false }));

// built-in middleware for json
app.use(express.json());
app.use(compression());

// middleware for cookies
app.use(cookieParser());

app.use("/login", require("./routes/login"));
app.use("/refresh", require("./routes/refresh"));
app.use("/logout", require("./routes/logout"));

// // //protected routes
app.use(verifyJWT);
app.use("/contacts", require("./routes/api/contacts"));
app.use("/documents", require("./routes/api/documents"));
app.use("/settings", require("./routes/api/settings"));
app.use("/user", require("./routes/api/users"));
app.use("/raport", require("./routes/api/raports"));
app.use("/update", require("./routes/api/update"));
app.use("/fk", require("./routes/api/fkRaport"));
app.use("/sql", require("./routes/api/sql"));

app.all("*", (req, res) => {
  res.status(404);
});

const options = {
  key: fs.readFileSync(path.join(__dirname, "cert", "krotoski.key")),
  cert: fs.readFileSync(path.join(__dirname, "cert", "krotoski.com.crt")),
};

// // connect to mongoDB
connectMongoDB();

// mongoose.connection.once("open", () => {
//   const server = https
//     .createServer(options, app)
//     .listen(process.env.PORT, "0.0.0.0", function () {
//       console.log(
//         "Express server listening on port " +
//           `${process.env.PORT ? process.env.PORT : 3000}`
//       );
//     });
// });

mongoose.connection.once("open", () => {
  console.log("Connected to mongoDB");
  app.listen(3500, () => {
    console.log(`Server is listenig on port 3500`);
  });
});
