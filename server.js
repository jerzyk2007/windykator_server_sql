require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
// const session = require("express-session");
const connectDB = require("./config/dbConn");
const corsOptions = require("./config/corsOptions");
const credentials = require("./middleware/credentials");
const verifyJWT = require("./middleware/verifyJWT");
const { logger } = require("./middleware/logEvents");
const bodyParser = require("body-parser");
const https = require("https");
const path = require("path");
const fs = require("fs");
const app = express();

// limit to 10 MB
// app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// custom middleware logger
app.use(logger);

// Handle options credentials check - before cors
// and fetch cookies credentials requirement
app.use(credentials);

//  CORS configuration
app.use(cors(corsOptions));

app.use(express.urlencoded({ extended: false }));

// built-in middleware for json
app.use(express.json());

// middleware for cookies
app.use(cookieParser());

app.use("/", (reg, res, next) => {
    res.send("Hello from SSL server");
});

// app.use("/login", require("./routes/login"));
// app.use("/refresh", require("./routes/refresh"));
// app.use("/logout", require("./routes/logout"));

// //protected routes
// app.use(verifyJWT);
// app.use("/contacts", require("./routes/api/contacts"));
// app.use("/documents", require("./routes/api/documents"));
// app.use("/settings", require("./routes/api/settings"));
// app.use("/user", require("./routes/api/users"));
// app.use("/raport", require("./routes/api/raports"));
// app.use("/update", require("./routes/api/update"));
// app.use("/fk", require("./routes/api/fkRaport"));

// app.all("*", (req, res) => {
//   res.status(404);
// });

const sslServer = https.createServer({
    key: fs.readFileSync(path.join(__dirname, "cert", "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "cert", "cert.pem")),
});

// const ssl = fs.readFileSync(path.join(__dirname, "cert", "key.pem"));
// console.log(ssl);

// connect to mongoDB
// connectDB();

mongoose.connection.once('open', () => {
    console.log('Connected to mongoDB');
    app.listen(process.env.PORT || 3000, () => {
        console.log(`Server is listenig on port ${process.env.PORT ? process.env.PORT : 3000}`);
    });
});