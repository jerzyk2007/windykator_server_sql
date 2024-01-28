const Setting = require('../model/Setting');
const User = require('../model/User');
const ROLES_LIST = require("../config/roles_list");

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
        // console.log(roles);
        // console.log(newRoles);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getSettings = async (req, res) => {
    try {
        const result = await Setting.find().exec();
        const rolesJSON = JSON.stringify(result[0].roles);
        const rolesObject = JSON.parse(rolesJSON);
        const roles = Object.entries(rolesObject).map(([role]) => role);
        const indexToRemove = roles.indexOf("Root");
        if (indexToRemove !== -1) {
            roles.splice(indexToRemove, 1);
        }
        const departments = [...result[0].departments];

        res.json([{ roles }, { departments }]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};


module.exports = {
    changeRoles,
    getSettings
};
