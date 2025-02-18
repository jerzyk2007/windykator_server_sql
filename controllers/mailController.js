const nodemailer = require("nodemailer");
const imaps = require("imap-simple");
const Imap = require("imap");
const { simpleParser } = require("mailparser"); // Do parsowania e-maili
const { logEvents } = require("../middleware/logEvents");
require("dotenv").config(); // Wczytanie zmiennych z .env

// Konfiguracja SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        ciphers: 'SSLv3'
    }
});




// Funkcja wysyłki e-maila
const sendEmail = async (mailOptions) => {
    try {
        // Wysyłanie e-maila przez SMTP
        const info = await transporter.sendMail(mailOptions);
        // console.log(info);
    } catch (error) {
        logEvents(`mailController, sendEmail: ${error}`, "reqServerErrors.txt");
    }

};

// const testMail = async () => {
//     const mailOptions = {
//         from: "powiadomienia-raportbl@krotoski.com",
//         to: "jerzy.komorowski@krotoski.com",
//         subject: "Testowy mail z powiadomienia-raportbl@krotoski.com",
//         // text: "Treść wiadomości testowej",
//         html: `
//         <b>Cześć Maciej</b><br>
//         Dziękuje za ałożenie maila.<br>
//         Dział tylko SMTP, IMAP nie chce działać.<br>
//         Możesz zerknać czy wszytsko włączone.<br>
//         Wiadomośc wysłana z programu raportBL.<br>
//         Jurek <br>
//         Odpisz na maila jerzy.komorowski@krotoski.com
//     `,
//     };

//     // Wywołanie funkcji
//     sendEmail(mailOptions);

// };

module.exports = {
    sendEmail,
    // testMail
};
