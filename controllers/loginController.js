// const bcryptjs = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const { logEvents } = require("../middleware/logEvents");
// const { connect_SQL } = require("../config/dbConn");

// const handleLogin = async (req, res) => {

//   const { userlogin, password } = req.body;

//   try {
//     if (!userlogin || !password) {
//       return res
//         .status(400)
//         .json({ message: "Userlogin and password are required" });
//     }

//     const [result] = await connect_SQL.query(
//       "SELECT userlogin, username, usersurname, password, id_user, permissions, roles FROM users WHERE userlogin = ?",
//       [userlogin]
//     );
//     console.log(result);

//     if (!result[0]?.userlogin) {
//       return res.sendStatus(401);
//     }

//     const match = await bcryptjs.compare(password, result[0].password);
//     if (match) {
//       const roles = Object.values(result[0].roles).filter(Boolean);

//       const refreshToken = jwt.sign(
//         {
//           userlogin: result[0].userlogin,
//         },
//         process.env.REFRESH_TOKEN_SECRET,
//         { expiresIn: "1d" }
//       );

//       await connect_SQL.query(
//         "UPDATE users SET refreshToken = ? WHERE userlogin = ?",
//         [refreshToken, userlogin]
//       );
//       res
//         .cookie("jwt", refreshToken, {
//           httpOnly: true,
//           sameSite: "None",
//           secure: true,
//           maxAge: 24 * 60 * 60 * 1000,
//         })
//         .json({
//           userlogin: result[0].userlogin,
//           username: result[0].username,
//           usersurname: result[0].usersurname,
//           id_user: result[0].id_user,
//           roles,
//           permissions: result[0].permissions,
//         });
//     } else {
//       res.sendStatus(401);
//     }
//   } catch (error) {
//     logEvents(`loginController, handleLogin: ${error}`, "reqServerErrors.txt");
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// module.exports = { handleLogin };

const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

const handleLogin = async (req, res) => {
  const { userlogin, password } = req.body;
  if (!userlogin || !password) {
    return res.status(400).json({ message: "Userlogin and password are required" });
  }

  let connection; // Deklaracja połączenia

  try {
    connection = await connect_SQL.getConnection(); // Pobranie połączenia z puli

    const [result] = await connection.query(
      "SELECT userlogin, username, usersurname, password, id_user, permissions, roles FROM users WHERE userlogin = ?",
      [userlogin]
    );

    if (!result.length) {
      return res.sendStatus(401);
    }

    const match = await bcryptjs.compare(password, result[0].password);
    if (!match) {
      return res.sendStatus(401);
    }

    const roles = Object.values(result[0].roles).filter(Boolean);

    const refreshToken = jwt.sign(
      { userlogin: result[0].userlogin },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "1d" }
    );

    await connection.query(
      "UPDATE users SET refreshToken = ? WHERE userlogin = ?",
      [refreshToken, userlogin]
    );

    res
      .cookie("jwt", refreshToken, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({
        userlogin: result[0].userlogin,
        username: result[0].username,
        usersurname: result[0].usersurname,
        id_user: result[0].id_user,
        roles,
        permissions: result[0].permissions,
      });

  } catch (error) {
    logEvents(`loginController, handleLogin: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (connection) connection.release(); // WAŻNE: Zwolnienie połączenia do puli!
  }
};

module.exports = { handleLogin };
