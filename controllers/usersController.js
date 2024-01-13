const User = require('../model/User');
const bcryptjs = require('bcryptjs');

const handleNewUser = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ 'message': 'Username and password are required.' });
    }
    // check for duplicate usernames in db
    const duplicate = await User.findOne({ username }).exec();
    if (duplicate) return res.status(409).json({ message: `User ${username} is existing in databse` }); // conflict - Unauthorized
    // if (duplicate) return res.sendStatus(409); // conflict - Unauthorized

    try {
        // encrypt the password
        const hashedPwd = await bcryptjs.hash(password, 10);
        // create and store the new user
        const result = await User.create({
            "username": username,
            "password": hashedPwd
        });
        res.status(201).json(`New user ${username} created.`);
    }
    catch (err) {
        res.status(500).json({ 'message': err.message });
    }
};

const handleChangeName = async (req, res) => {
    const { username, newUsername } = req.body;
    if (!username || !newUsername) {
        return res.status(400).json({ 'message': 'Username and new username are required.' });
    }
    const duplicate = await User.findOne({ username: newUsername }).exec();
    if (duplicate) return res.status(409).json({ message: `User ${newUsername} is existing in databse` }); // conflict - Unauthorized

    try {
        const result = await User.updateOne(
            { username },
            { $set: { username: newUsername } }
        );
        res.status(201).json(`New username is ${newUsername}.`);
    }
    catch (err) {
        res.status(500).json({ 'message': err.message });
    }

};
const handleChangePassword = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ 'message': 'Wymagane są nazwa użytkownika i hasło.' });
    }
    try {
        const findUser = await User.find({ username }).exec();
        const hashedPwd = await bcryptjs.hash(password, 10);
        if (findUser) {
            const result = await User.updateOne(
                { username: username },
                { $set: { password: hashedPwd } }
            );
        } else {
            return res.status(404).json({ 'message': 'User not found.' });
        }

        res.status(201).json({ 'message': 'Password is changed' });
    }
    catch (err) {
        res.status(500).json({ 'message': err.message });
    }
};

module.exports = {
    handleNewUser,
    handleChangeName,
    handleChangePassword
};