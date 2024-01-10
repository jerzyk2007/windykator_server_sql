require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/dbConn');
const corsOptions = require('./config/corsOptions');
const credentials = require('./middleware/credentials');
const verifyJWT = require('./middleware/verifyJWT');
const { logger } = require('./middleware/logEvents');
const bodyParser = require('body-parser');


// limit to 10 MB
// app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

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


app.use('/login', require('./routes/login'));
app.use('/refresh', require('./routes/refresh'));
app.use('/logout', require('./routes/logout'));
app.use('/phrases', require('./routes/api/phrases'));
app.use('/collections', require('./routes/api/collections'));

//protected routes
app.use(verifyJWT);
app.use('/user', require('./routes/api/users'));
app.use('/search', require('./routes/api/phrases'));
app.use('/add-data', require('./routes/api/phrases'));



app.all('*', (req, res) => {
    res.status(404);
});

// connect to mongoDB
connectDB();

mongoose.connection.once('open', () => {
    console.log('Connected to mongoDB');
    app.listen(process.env.PORT || 3500, () => {
        console.log(`Server is listenig on port 3500`);
    });
});