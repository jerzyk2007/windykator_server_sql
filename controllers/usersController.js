const User = require('../model/User');
const bcryptjs = require('bcryptjs');
const ROLES_LIST = require("../config/roles_list");

const createNewUser = async (req, res) => {
    const { userlogin, password, username, usersurname } = req.body;

    if (!userlogin || !password || !username || !usersurname) {
        return res.status(400).json({ 'message': 'Userlogin and password are required.' });
    }
    // check for duplicate userlogin in db
    const duplicate = await User.findOne({ userlogin }).exec();
    if (duplicate) return res.status(409).json({ message: `User ${userlogin} is existing in databse` }); // conflict - Unauthorized
    // if (duplicate) return res.sendStatus(409); // conflict - Unauthorized

    try {
        // encrypt the password
        const hashedPwd = await bcryptjs.hash(password, 10);
        // create and store the new user
        const result = await User.create({
            username,
            usersurname,
            userlogin,
            password: hashedPwd
        });
        console.log(result);

        res.status(201).json(`Nowy użytkownik ${userlogin} dodany.`);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ 'message': err.message });
    }
};

const handleChangeLogin = async (req, res) => {
    const { userlogin, newUserlogin } = req.body;
    if (!userlogin || !newUserlogin) {
        return res.status(400).json({ 'message': 'Userlogin and new userlogin are required.' });
    }
    const duplicate = await User.findOne({ userlogin: newUserlogin }).exec();
    if (duplicate) return res.status(409).json({ message: newUserlogin }); // conflict - Unauthorized

    try {
        const findUser = await User.findOne({ userlogin }).exec();
        if (findUser?.roles && findUser.roles.Root) {
            return res.status(404).json({ 'message': 'User not found.' });
        } else {
            const result = await User.updateOne(
                { userlogin },
                { $set: { userlogin: newUserlogin } }
            );
            res.status(201).json({ message: newUserlogin });
        }
    }
    catch (err) {
        res.status(500).json({ 'message': err.message });
    }

};

const handleChangeName = async (req, res) => {
    const { userlogin, name, surname } = req.body;
    if (!userlogin || !name || !surname) {
        return res.status(400).json({ 'message': 'Userlogin, name and surname are required.' });
    }
    try {
        const findUser = await User.findOne({ userlogin }).exec();
        if (findUser?.roles && findUser.roles.Root) {
            return res.status(404).json({ 'message': 'User not found.' });
        } else {
            const result = await User.updateOne(
                { userlogin },
                { $set: { username: name, usersurname: surname } }
            );
            res.status(201).json({ message: 'The name and surname have been changed.' });
        }
    }
    catch (err) {
        res.status(500).json({ 'message': err.message });
    }
};


const changePassword = async (req, res) => {
    const { userlogin, password } = req.body;
    const refreshToken = req.cookies.jwt;
    if (!userlogin || !password) {
        return res.status(400).json({ 'message': 'Userlogin and new userlogin are required.' });
    }
    try {
        // const findUser = await User.find({ username }).exec();
        const findUser = await User.find({ refreshToken, userlogin }).exec();
        const hashedPwd = await bcryptjs.hash(password, 10);
        if (findUser) {
            const result = await User.updateOne(
                { userlogin },
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
    const { userlogin, password } = req.body;
    if (!userlogin || !password) {
        return res.status(400).json({ 'message': 'Userlogin and new userlogin are required.' });
    }
    try {
        const findUser = await User.findOne({ userlogin }).exec();
        const hashedPwd = await bcryptjs.hash(password, 10);
        if (findUser) {
            if (findUser?.roles && findUser.roles.Root) {
                return res.status(404).json({ 'message': 'User not found.' });
            } else {
                const result = await User.updateOne(
                    { userlogin },
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
    const { userlogin, permissions } = req.body;
    const transformedData = {
        permissions: {
            Basic: permissions.Basic || false,
            Standard: permissions.Standard || false
        }
    };
    try {
        const findUser = await User.findOne({ userlogin }).exec();
        if (findUser) {
            if (findUser?.roles && findUser.roles.Root) {
                return res.status(404).json({ 'message': 'User not found.' });
            } else {
                const result = await User.updateOne(
                    { userlogin },
                    { $set: { permissions: transformedData.permissions } }
                );
                res.status(201).json({ 'message': 'Permissions are changed' });
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

const changeUserDepartments = async (req, res) => {
    const { userlogin, departments } = req.body;
    try {
        const findUser = await User.findOne({ userlogin }).exec();
        if (findUser) {
            if (findUser?.roles && findUser.roles.Root) {
                return res.status(404).json({ 'message': 'User not found.' });
            } else {
                const result = await User.updateOne(
                    { userlogin },
                    { $set: { departments } }
                );
                res.status(201).json({ 'message': 'Departments are changed' });
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
    const { tableSettings, userlogin } = req.body;
    if (!userlogin) {
        return res.status(400).json({ 'message': 'Userlogin is required.' });
    }

    try {
        const findUser = await User.findOne({ userlogin }).exec();
        if (findUser) {
            const result = await User.updateOne(
                { userlogin },
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
    const { userlogin } = req.query;
    if (!userlogin) {
        return res.status(400).json({ 'message': 'Userlogin is required.' });
    }
    try {
        const findUser = await User.findOne({ userlogin }).exec();
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
        const findUsers = await User.find({ userlogin: { $regex: search, $options: 'i' } }).exec();
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

const changeRoles = async (req, res) => {
    const { _id } = req.params;
    const { roles } = req.body;
    const newRoles = { ...ROLES_LIST };
    const filteredRoles = Object.fromEntries(
        Object.entries(newRoles).filter(([key]) => roles.includes(key))
    );
    try {
        const findUser = await User.findOne({ _id }).exec();

        if (findUser) {
            const result = await User.updateOne(
                { _id },
                { $set: { roles: filteredRoles } }
            );
            res.status(201).json({ 'message': 'Roles are saved.' });
        } else {
            res.status(400).json({ 'message': 'Roles are not saved.' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    createNewUser,
    handleChangeLogin,
    changePassword,
    saveTableSettings,
    getTableSettings,
    getUsersData,
    changeUserPermissions,
    changePasswordAnotherUser,
    deleteUser,
    handleChangeName,
    changeUserDepartments,
    changeRoles
};