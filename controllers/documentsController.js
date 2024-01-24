const Document = require('../model/Documents');

const getAllDocuments = async (req, res) => {
    const { info } = req.params;
    let filteredData = [];
    try {
        const result = await Document.find({});
        if (info === "actual") {
            filteredData = result.filter(item => item.DOROZLICZ_ !== 0);
        } else if (info === "archive") {
            filteredData = result.filter(item => item.DOROZLICZ_ === 0);
        } else if (info === "all") {
            filteredData = result;
        }
        res.json(filteredData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { getAllDocuments };