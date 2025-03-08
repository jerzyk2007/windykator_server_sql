const bcryptjs = require("bcryptjs");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const crypto = require("crypto");
const { sendEmail } = require('./mailController');



//funkcja generuje hasło i zaszyfrowane hasło do DB zgodnie z załaożeniami bezpieczeństwa
const generatePassword = (length = 15) => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    return Array.from({ length }, () => chars[crypto.randomInt(0, chars.length)]).join("");
};

// const baseUrl = "http://localhost:3000";
const baseUrl = "https://raportbl.krotoski.com";

const resetPass = async (req, res) => {
    const { userlogin } = req.body;
    try {

        const [checkMail] = await connect_SQL.query(`SELECT userlogin FROM users WHERE userlogin = ?`, [userlogin]);
        if (!checkMail.length) {
            return res.end();
        }

        await connect_SQL.query('DELETE FROM password_resets WHERE email = ?',
            [
                userlogin
            ]
        );

        const token = generatePassword(30);
        const encodedToken = encodeURIComponent(token);
        const url = "password-reset";
        const resetLink = `${baseUrl}/${url}/${encodedToken}`;

        await connect_SQL.query(`INSERT INTO password_resets (email, token) VALUES (?, ?)`, [
            userlogin,
            token
        ]);

        const mailOptions = {
            from: "powiadomienia-raportbl@krotoski.com",
            to: `${userlogin}`,
            subject: "Reset hasła",
            html: `
            <b>Dzień dobry</b><br>
            <br>
            Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta. <br/>
            Jeśli to Ty wysłałeś tę prośbę, kliknij w poniższy link, aby potwierdzić procedurę zmiany hasła: <br>
              <br>
            <a href=${resetLink} target="_blank">Zresetuj hasło</a><br>
          
            <br>
            Po kliknięciu w powyższy link otrzymasz kolejny e-mail zawierający odnośnik umożliwiający zmianę hasła.<br/>
            Jeśli wiadomość nie dotrze w ciągu 15 minut, prosimy o ponowne rozpoczęcie procedury resetowania hasła.<br>
            <br>
            Jeśli nie prosiłeś o zmianę hasła, zignoruj tę wiadomość – Twoje konto pozostaje bezpieczne.<br/>        
            <br>
            Z poważaniem.<br>
            Dział Nadzoru i Kontroli Należności <br>
        `,
        };
        await sendEmail(mailOptions);
        res.end();

    } catch (error) {
        logEvents(`resetPasswordController, resetPass: ${error}`, "reqServerErrors.txt");
        res.status(500).json({ error: "Server error" });
    }
};

//sprawdzam czy użytkownik zmieścił się w czasie 15 min
const verifyDatePass = (date) => {
    const currentTime = new Date(); // Bieżący czas

    // Przekształcamy datę z formatu 'YYYY-MM-DD HH:MM:SS' do obiektu Date
    const createdAtDate = new Date(date);

    // Obliczamy różnicę w czasie w minutach
    const timeDifferenceInMinutes = (currentTime - createdAtDate) / (1000 * 60);
    return timeDifferenceInMinutes;
};

const confirmPass = async (req, res) => {
    const { decodedToken } = req.body;
    try {
        const [checkToken] = await connect_SQL.query(`SELECT * FROM password_resets WHERE token = ?`, [decodedToken]);

        if (checkToken[0]?.id_password_resets) {
            const verifyDate = verifyDatePass(checkToken[0].created_at);

            if (verifyDate <= 15) {
                const token = generatePassword(30);

                await connect_SQL.query('UPDATE password_resets SET token = ? WHERE token = ?',
                    [token,
                        checkToken[0].token
                    ]
                );

                const url = "password-confirm-reset";
                const encodedToken = encodeURIComponent(token);
                // const resetLink = `${baseUrl}/${url}/${encodedToken}/${checkToken[0].email}`;
                const resetLink = `${baseUrl}/${url}/${encodedToken}`;
                const mailOptions = {
                    from: "powiadomienia-raportbl@krotoski.com",
                    to: `${checkToken[0].email}`,
                    subject: "Reset hasła",
                    html: `
                    <b>Dzień dobry</b><br>
                    <br>
                    Kliknij w poniższy link, aby ustawić nowe hasło: <br>
                    <a href=${resetLink} target="_blank">Zresetuj hasło</a><br>
                    <br>

                    <br>
                    Z poważaniem.<br>
                    Dział Nadzoru i Kontroli Należności <br>
                `,
                };

                await sendEmail(mailOptions);
            }
        }
        res.end();

    } catch (error) {
        logEvents(`resetPasswordController, confirmPass: ${error}`, "reqServerErrors.txt");
        res.status(500).json({ error: "Server error" });
    }
};

//sprawdzam czy ważność hasła jeszcze nie wygasła
const verifyPass = async (req, res) => {
    const { token } = req.body;
    try {
        if (!token) {
            return res.end();
        }
        const [verifyAccess] = await connect_SQL.query(`SELECT * FROM password_resets WHERE token = ?`, [token]);
        if (!verifyAccess.length) {
            return res.json({ checkDate: false });
        }
        const verifyDate = verifyDatePass(verifyAccess[0].created_at);
        if (verifyDate <= 15) {
            return res.json({ checkDate: true });
        } else {
            return res.json({ checkDate: false });
        }
    }
    catch (error) {
        logEvents(`resetPasswordController, verifyPass: ${error}`, "reqServerErrors.txt");
    }
};

// funckja zmienijąca hasła 
const changePass = async (req, res) => {
    const { password, token } = req.body;
    try {

        const hashedPwd = await bcryptjs.hash(password, 10);
        const [verifyAccess] = await connect_SQL.query(`SELECT email FROM password_resets WHERE token = ? `, [token]);
        if (verifyAccess[0].email) {
            await connect_SQL.query('UPDATE users SET password = ? WHERE userlogin = ?',
                [hashedPwd,
                    verifyAccess[0].email
                ]
            );
            await connect_SQL.query('DELETE FROM password_resets WHERE email = ?',
                [
                    verifyAccess[0].email
                ]
            );
        }
        res.end();
    }
    catch (error) {
        logEvents(`resetPasswordController, changePass: ${error}`, "reqServerErrors.txt");
    }
};

module.exports = { resetPass, confirmPass, verifyPass, changePass };
