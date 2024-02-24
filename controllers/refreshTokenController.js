const User = require('../model/User');
const jwt = require('jsonwebtoken');

const handleRefreshToken = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        return res.sendStatus(401);
    }
    const refreshToken = cookies.jwt;

    const findUser = await User.findOne({ refreshToken }).exec();

    if (!findUser) {
        return res.sendStatus(403); // forbidden
    }

    // evaluate jwt
    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        (err, decoded) => {
            if (err || findUser.userlogin !== decoded.userlogin) return res.sendStatus(403);
            const roles = Object.values(findUser.roles).filter(Boolean);
            const accessToken = jwt.sign(
                {
                    "UserInfo":
                    {
                        "userlogin": decoded.userlogin,
                        "username": decoded.username,
                        "usersurname": decoded.usersurname,
                        "roles": roles
                    }
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '3m' }
            );
            res.json({
                accessToken,
                roles,
                userlogin: decoded.userlogin,
                username: findUser.username,
                usersurname: findUser.usersurname,
                permissions: findUser.permissions,
                _id: findUser._id
            });
        }
    );
};

module.exports = { handleRefreshToken };