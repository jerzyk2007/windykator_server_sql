const Setting = require('../model/Setting');

const saveSettings = async (req, res) => {
    const { columnSettings } = req.body;
    try {
        // Sprawdzamy, czy obiekt `column` zawiera dane
        if (columnSettings && Object.keys(columnSettings).length > 0) {
            // Aktualizujemy ustawienia w bazie danych
            const result = await Setting.findOneAndUpdate({}, { columnSettings }, { new: true, upsert: true });

            // Zwracamy zaktualizowane ustawienia
            res.end();

            // res.json('result');
        } else {
            res.status(400).json({ error: 'Invalid data provided' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getSettings = async (req, res) => {
    try {
        const result = await Setting.findOne().exec();
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    saveSettings,
    getSettings
};
