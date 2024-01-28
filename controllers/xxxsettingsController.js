// const Setting = require('../model/xxxSetting');
// const TableSetting = require('../model/TableSettings');

// const saveSettings = async (req, res) => {
//     const { columnSettings } = req.body;
//     try {
//         // Sprawdzamy, czy obiekt `column` zawiera dane
//         if (columnSettings && Object.keys(columnSettings).length > 0) {
//             // Aktualizujemy ustawienia w bazie danych
//             const result = await Setting.findOneAndUpdate({}, { columnSettings }, { new: true, upsert: true });

//             // Zwracamy zaktualizowane ustawienia
//             res.end();

//             // res.json('result');
//         } else {
//             res.status(400).json({ error: 'Invalid data provided' });
//         }
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// };

// const getSettings = async (req, res) => {
//     try {
//         const result = await Setting.findOne().exec();
//         res.json(result);
//     }
//     catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// };

// const saveTableSettings = async (req, res) => {
//     const { tableSettings } = req.body;
//     console.log(tableSettings.size);

//     // Konwersja obiektu do mapy

//     // const result = await TableSetting.findOneAndUpdate({}, { "tableSettings.size": sizeMap }, { new: true, upsert: true });
//     const result = await TableSetting.findOneAndUpdate({}, { tableSettings }, { new: true, upsert: true });
//     console.log(result);

//     res.end();
// };

// module.exports = {
//     saveSettings,
//     getSettings,
//     saveTableSettings
// };
