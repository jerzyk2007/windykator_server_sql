const mongoose = require('mongoose');

const getCollectionsName = async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map((collection) => collection.name);
        const filteredCollectionNames = collectionNames.filter((name) => name !== "users");

        const collectionInfoPromises = filteredCollectionNames.map(async (collectionName) => {
            const count = await mongoose.connection.db.collection(collectionName).countDocuments();
            return { name: collectionName, count };
        });
        const collectionInfo = await Promise.all(collectionInfoPromises);
        const sortedCollectionInfo = collectionInfo.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        res.json(sortedCollectionInfo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = getCollectionsName;
