const Contact = require('../model/Contact');

const getAllContacts = async (req, res) => {
    try {
        const result = await Contact.find({});
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getSearchContacts = async (req, res) => {
    const { search } = req.params;
    try {
        const result = await Contact.find({});
        const filteredContacts = result.filter(item =>
            ((item.name).toLowerCase().includes(search.toLowerCase()))
            || (item.NIP && item.NIP.toString().includes(search))

        );
        res.status(200).json(filteredContacts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getUpdateContacts = async (req, res) => {
    const { _id } = req.params;
    const { contactItem } = req.body;
    try {
        const findUser = await Contact.findOne({ _id }).exec();
        if (findUser) {
            const result = await Contact.findOneAndUpdate({ _id }, contactItem, { new: true, upsert: true });
            console.log(result);
            res.status(201).json({ 'message': 'Contact is updated' });
        } else {
            res.status(400).json({ 'message': 'Contact is not updated.' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getAllContacts,
    getSearchContacts,
    getUpdateContacts
};
