const UpdateDB = require('../model/UpdateDB');



const getTime = async (req, res) => {
    try {
        const result = await UpdateDB.findOne({}, { date: 1 }).exec();
        res.json(result.date);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getTime
};
