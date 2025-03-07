const nodemailer = require("nodemailer");
const imaps = require("imap-simple");
const Imap = require("imap");
const { simpleParser } = require("mailparser"); // Do parsowania e-maili
const { logEvents } = require("../middleware/logEvents");
require("dotenv").config(); // Wczytanie zmiennych z .env


// const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: process.env.SMTP_PORT || 465,
//     secure: false,
//     auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//     },
// });

// // Konfiguracja SMTP dla lokalnego servera
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: 'powiadomienia-raportbl@krotoski.com',
        pass: 'P7$Css*@86J7'
    },
});



// // Funkcja wysyłki e-maila
const sendEmail = async (mailOptions) => {

    try {
        // Wysyłanie e-maila przez SMTP

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Błąd wysyłki e-maila:", error);
        logEvents(`mailController, sendEmail: ${error}`, "reqServerErrors.txt");
    }

};


module.exports = {
    sendEmail,
};
