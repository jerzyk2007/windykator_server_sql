const nodemailer = require("nodemailer");
const imaps = require("imap-simple");
const Imap = require("imap");
const { simpleParser } = require("mailparser"); // Do parsowania e-maili
const { logEvents } = require("../middleware/logEvents");
require("dotenv").config(); // Wczytanie zmiennych z .env

// // Konfiguracja SMTP
// // const transporter = nodemailer.createTransport({
// //     host: process.env.SMTP_HOST,
// //     port: process.env.SMTP_PORT || 465,
// //     secure: true,
// //     auth: {
// //         user: process.env.SMTP_USER,
// //         pass: process.env.SMTP_PASS,
// //     },
// // });

// // // Konfiguracja IMAP
// // const imapConfig = {
// //     imap: {
// //         user: process.env.IMAP_USER,
// //         password: process.env.IMAP_PASS,
// //         host: process.env.IMAP_HOST,
// //         port: process.env.IMAP_PORT || 993,
// //         tls: true,
// //         authTimeout: 3000,
// //     },
// // };

// // Konfiguracja SMTP
// // const transporter = nodemailer.createTransport({
// //     host: "smtp.office365.com",
// //     port: 587,
// //     secure: false,
// //     auth: {
// //         user: "jerzy.komorowski@krotoski.com",
// //         pass: "...",
// //     },
// //     tls: {
// //         ciphers: 'SSLv3'
// //     }
// // });
// const transporter = nodemailer.createTransport({
//     host: "smtp.poczta.onet.pl",
//     port: 465,
//     secure: true,
//     auth: {
//         user: "jerzy.komorowski@onet.eu",
//         pass: "Kubulutek1!",
//     },
// });

// // Konfiguracja IMAP
// const imapConfig = {
//     imap: {
//         user: "jerzy.komorowski@onet.eu",
//         password: "Kubulutek1!",
//         host: "imap.poczta.onet.pl",
//         port: 993,
//         tls: true,
//         authTimeout: 3000,
//     },
// };


// // Funkcja wysyłki e-maila
// const sendEmail = async (mailOptions) => {


//     try {
//         // Wysyłanie e-maila przez SMTP
//         const info = await transporter.sendMail(mailOptions);
//         // console.log(info);
//     } catch (error) {
//         console.error("Błąd wysyłki e-maila:", error);
//         logEvents(`mailController, sendEmail: ${error}`, "reqServerErrors.txt");
//     }

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
