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
        const allContacts = await Contact.find({});
        // const filteredContacts = allContacts.filter(contact =>
        //     ((contact.name).toLowerCase().includes(search.toLowerCase()))
        //     || (contact.NIP && contact.NIP.toString().includes(search))
        // );
        const filteredContacts = allContacts.filter(item =>
            // (item.name.some(substring => substring.toLowerCase().includes(search.toLowerCase())))
            ((item.name).toLowerCase().includes(search.toLowerCase()))
            || (item.NIP && item.NIP.toString().includes(search))

        );
        // console.log(filteredContacts);
        // console.log(filteredContacts);
        // res.json('ok');
        res.status(200).json(filteredContacts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getAllContacts,
    getSearchContacts,
};
