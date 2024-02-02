const Users = require('../model/User');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const handleLogin = async (req, res) => {
    const { userlogin, password } = req.body;

    if (!userlogin || !password) {
        return res.status(400).json({ 'message': 'Userlogin and password are required' });
    }
    const findUser = await Users.findOne({ userlogin }).exec();
    if (!findUser) {
        return res.sendStatus(401);
    }
    const match = await bcryptjs.compare(password, findUser.password);
    if (match) {
        const roles = Object.values(findUser.roles).filter(Boolean);
        const accessToken = jwt.sign({
            "UserInfo": {
                "userlogin": findUser.userlogin,
                "roles": roles
            }
        },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '10s' });

        const refreshToken = jwt.sign({
            "userlogin": findUser.userlogin
        },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '1d' });

        findUser.refreshToken = refreshToken;
        const result = await findUser.save();
        res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge: 24 * 60 * 60 * 1000 });
        res.json({
            userlogin: findUser.userlogin,
            username: findUser.username,
            usersurname: findUser.usersurname,
            _id: findUser._id,
            roles,
        });
    } else {
        res.sendStatus(401);
    }
};


module.exports = { handleLogin };