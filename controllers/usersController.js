const User = require('../model/User');
const bcryptjs = require('bcryptjs');

const createNewUser = async (req, res) => {
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
        res.status(201).json(`Nowy użytkownik ${username} dodany.`);
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
    if (duplicate) return res.status(409).json({ message: newUsername }); // conflict - Unauthorized

    try {
        const findUser = await User.findOne({ username }).exec();
        if (findUser?.roles && findUser.roles.Root) {
            return res.status(404).json({ 'message': 'User not found.' });
        } else {
            const result = await User.updateOne(
                { username },
                { $set: { username: newUsername } }
            );
            res.status(201).json({ message: newUsername });
        }
    }
    catch (err) {
        res.status(500).json({ 'message': err.message });
    }

};
const changePassword = async (req, res) => {
    const { username, password } = req.body;
    const refreshToken = req.cookies.jwt;
    if (!username || !password) {
        return res.status(400).json({ 'message': 'Username and new username are required.' });
    }
    try {
        // const findUser = await User.find({ username }).exec();
        const findUser = await User.find({ refreshToken, username }).exec();
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
        console.error(err);
        res.status(500).json({ 'message': err.message });
    }
};

const changePasswordAnotherUser = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ 'message': 'Username and new username are required.' });
    }
    try {
        const findUser = await User.findOne({ username }).exec();
        const hashedPwd = await bcryptjs.hash(password, 10);
        if (findUser) {
            if (findUser?.roles && findUser.roles.Root) {
                return res.status(404).json({ 'message': 'User not found.' });
            } else {
                const result = await User.updateOne(
                    { username: username },
                    { $set: { password: hashedPwd } }
                );
                res.status(201).json({ 'message': 'Password is changed' });
            }
        }
        else {
            return res.status(404).json({ 'message': 'User not found.' });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ 'message': err.message });
    }
};

const changeUserPermissions = async (req, res) => {
    const { username, permissions } = req.body;
    const transformedData = {
        permissions: {
            Basic: permissions.Basic || false,
            Standard: permissions.Standard || false
        }
    };
    try {
        const findUser = await User.findOne({ username }).exec();
        if (findUser) {
            if (findUser?.roles && findUser.roles.Root) {
                return res.status(404).json({ 'message': 'User not found.' });
            } else {
                const result = await User.updateOne(
                    { username: username },
                    { $set: { permissions: transformedData.permissions } }
                );
            }
        }
        else {
            return res.status(404).json({ 'message': 'User not found.' });
        }
        res.status(201).json({ 'message': 'Permissions are changed' });

    }
    catch (err) {
        console.error(err);
        res.status(500).json({ 'message': err.message });
    }
};

const deleteUser = async (req, res) => {
    const { _id } = req.params;
    if (!_id) {
        return res.status(400).json({ 'message': 'Id is required.' });
    }
    try {
        const findUser = await User.findOne({ _id }).exec();
        if (findUser) {
            if (findUser?.roles && findUser.roles.Root) {
                return res.status(404).json({ 'message': 'User not found.' });
            } else {
                const result = await User.deleteOne(
                    { _id },
                );
                res.status(201).json({ 'message': 'User is deleted.' });
            }
        } else {
            return res.status(404).json({ 'message': 'User not found.' });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ 'message': err.message });
    }
};

const saveTableSettings = async (req, res) => {
    const { tableSettings, username } = req.body;
    if (!username) {
        return res.status(400).json({ 'message': 'Username is required.' });
    }
    try {
        const findUser = await User.findOne({ username }).exec();
        if (findUser) {
            const result = await User.updateOne(
                { username: username },
                { $set: { tableSettings } }
            );
            res.status(201).json({ 'message': 'Table settings are changed' });
        } else {
            res.status(400).json({ 'message': 'Table settings are not changed' });
        }
    }
    catch (err) {
        console.error(error);

        res.status(500).json({ 'message': err.message });
    }
};

const getTableSettings = async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ 'message': 'Username is required.' });
    }
    try {
        const findUser = await User.findOne({ username }).exec();
        if (findUser) {
            res.json(findUser.tableSettings);
        } else {
            return res.status(404).json({ 'message': 'User not found.' });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getUsersData = async (req, res) => {
    const { search } = req.query;
    try {
        const findUsers = await User.find({ username: { $regex: search, $options: 'i' } }).exec();
        if (findUsers.length > 0) {
            const keysToRemove = ['password', 'refreshToken'];

            // sprawdzenie ilu użytkowników pasuje do search, jesli użytkownik ma uprawnienia Root to nie jest dodany
            const filteredUsers = findUsers
                .map(user => {
                    const filteredUser = { ...user._doc };
                    keysToRemove.forEach(key => delete filteredUser[key]);
                    if (filteredUser.roles) {
                        filteredUser.roles = Object.keys(filteredUser.roles).map(role => role);
                    }
                    return filteredUser;
                })
                // .filter(user => !user.roles || (user.roles && user.roles.Root !== 500));
                .filter(user => !user.roles.includes('Root'));

            res.json(filteredUsers);
        } else {
            res.json([]);

        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    createNewUser,
    handleChangeName,
    changePassword,
    saveTableSettings,
    getTableSettings,
    getUsersData,
    changeUserPermissions,
    changePasswordAnotherUser,
    deleteUser
};