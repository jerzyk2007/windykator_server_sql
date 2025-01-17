// const User = require("../model/User");
const jwt = require("jsonwebtoken");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

const handleRefreshToken = async (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    return res.sendStatus(401);
  }

  const refreshToken = cookies.jwt;

  try {
    // const findUser = await User.findOne({ refreshToken }).exec();

    const [findUser] = await connect_SQL.query(
      "SELECT id_user, userlogin, username, usersurname, permissions, roles FROM users WHERE refreshToken = ?",
      [refreshToken]
    );

    if (!findUser[0]) {
      return res.sendStatus(403); // forbidden
    }

    // evaluate jwt
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err || findUser[0].userlogin !== decoded.userlogin)
          return res.sendStatus(403);
        const roles = Object.values(findUser[0].roles).filter(Boolean);
        const accessToken = jwt.sign(
          {
            UserInfo: {
              userlogin: decoded.userlogin,
              username: decoded.username,
              usersurname: decoded.usersurname,
              roles: roles,
            },
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "3m" }
        );
        res.json({
          accessToken,
          roles,
          userlogin: decoded.userlogin,
          username: findUser[0].username,
          usersurname: findUser[0].usersurname,
          permissions: findUser[0].permissions,
          id_user: findUser[0].id_user,
        });
      }
    );
  } catch (error) {
    logEvents(
      `refreshTokenController, handleRefreshToken: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { handleRefreshToken };
