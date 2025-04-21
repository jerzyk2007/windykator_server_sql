// const User = require("../model/User");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

const handleLogout = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) {
    return res.sendStatus(204); // No content
  }
  const refreshToken = cookies.jwt;
  try {
    const [result] = await connect_SQL.query(
      "SELECT * FROM company_users WHERE refreshToken = ?",
      [refreshToken]
    );

    if (!result[0]?.userlogin) {
      res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "None",
        secure: true,
      });
      return res.sendStatus(204);
    }
    // Delete the refreshToken in db
    await connect_SQL.query(
      "UPDATE company_users SET refreshToken = ? WHERE refreshToken = ?",
      ["", refreshToken]
    );

    res
      .clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true })
      .sendStatus(204); // secure : true - only servers on https
  } catch (error) {
    logEvents(
      `logoutController, handleLogout: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { handleLogout };
