const User = require('../model/User');
const { logEvents } = require('../middleware/logEvents');

const handleLogout = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        return res.sendStatus(204); // No content
    }
    const refreshToken = cookies.jwt;
    try {
        // Is refreshToken in db ?
        const foundUser = await User.findOne({ refreshToken }).exec();
        if (!foundUser) {
            res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
            // res.clearCookie('jwt', { httpOnly: true });
            return res.sendStatus(204);
        }
        // Delete the refreshToken in db
        foundUser.refreshToken = '';
        await foundUser.save();

        res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true }); // secure : true - only servers on https
        res.sendStatus(204);
    }
    catch (error) {
        logEvents(`logoutController, handleLogout: ${error}`, 'reqServerErrors.txt');
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { handleLogout };