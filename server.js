require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
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
//wywołuje cykleczne funkcje z pliku getDataFromMSSQL
require('./controllers/getDataFromMSSQL');
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
app.use("/items", require("./routes/api/items"));
app.use("/add-data", require("./routes/api/addDataFromExcelFile"));

app.all("*", (req, res) => {
  res.status(404);
});

const options = {
  key: fs.readFileSync(path.join(__dirname, "cert", "krotoski.key")),
  cert: fs.readFileSync(path.join(__dirname, "cert", "krotoski.com.crt")),
};

// cykliczne wywoływanie funkcji o określonej godzinie
// W wyrażeniu cron.schedule('58 16 * * *', ...) każda część odpowiada określonemu elementowi daty i czasu. Oto pełne wyjaśnienie:
// Minuta – 58: Minuta, w której zadanie ma się uruchomić (tutaj: 58 minuta każdej godziny).
// Godzina – 16: Godzina, w której zadanie ma się uruchomić (tutaj: 16, czyli 16:58).
// Dzień miesiąca – *: Gwiazdka oznacza każdy dzień miesiąca (od 1 do 31).
// Miesiąc – *: Gwiazdka oznacza każdy miesiąc (od stycznia do grudnia).
// Dzień tygodnia – *: Gwiazdka oznacza każdy dzień tygodnia (od poniedziałku do niedzieli).
// cron.schedule('07 17 * * *', getData, {
//   timezone: "Europe/Warsaw"
// });


//ustawienie servera linux
https
  .createServer(options, app)
  .listen(process.env.PORT, "0.0.0.0", function () {
    console.log(
      "Express server listening on port " +
      `${process.env.PORT ? process.env.PORT : 3000}`
    );
  });

// ustawienie servera lokalnego
// app.listen(3500, () => {
//   console.log(`Server is listening on port 3500`);
// });

