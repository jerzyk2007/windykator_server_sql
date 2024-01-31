const Setting = require('../model/Setting');

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

const changeColumns = async (req, res) => {
    const { columns } = req.body;
    try {
        const result = await Setting.findOneAndUpdate({}, { $set: { columns } }, { new: true, upsert: true });
        // res.json(result);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getColumns = async (req, res) => {
    try {
        const result = await Setting.find({}).exec();
        const { columns } = result[0];
        res.json(columns);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getSettings,
    changeColumns,
    getColumns
};
