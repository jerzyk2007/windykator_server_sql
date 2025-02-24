const nodemailer = require("nodemailer");
const imaps = require("imap-simple");
const Imap = require("imap");
const { simpleParser } = require("mailparser"); // Do parsowania e-maili
const { logEvents } = require("../middleware/logEvents");
require("dotenv").config(); // Wczytanie zmiennych z .env

// // Konfiguracja SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});







// // Funkcja wysyłki e-maila
const sendEmail = async (mailOptions) => {


    try {
        // Wysyłanie e-maila przez SMTP
        const info = await transporter.sendMail(mailOptions);
        // console.log(info);
    } catch (error) {
        console.error("Błąd wysyłki e-maila:", error);
        logEvents(`mailController, sendEmail: ${error}`, "reqServerErrors.txt");
    }

};


module.exports = {
    sendEmail,
    // testMail
};
