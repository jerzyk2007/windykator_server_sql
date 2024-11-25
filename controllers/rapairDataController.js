const { connect_SQL } = require("../config/dbConn");


// do rozdzielenia kancelarii zwykłych i TU
const repairKanc = async (req, res) => {
    try {
        const [getLawsName] = await connect_SQL.query(
            `SELECT id_action, JAKA_KANCELARIA FROM documents_actions 
            WHERE JAKA_KANCELARIA != 'BRAK' AND JAKA_KANCELARIA != 'M_LEGAL' AND JAKA_KANCELARIA != 'INWEST INKASO'`
        );

        for (const doc of getLawsName) {
            console.log(doc);
            // await connect_SQL.query(
            //     "UPDATE documents_actions SET JAKA_KANCELARIA_TU = ? WHERE id_action = ?",
            //     [doc.JAKA_KANCELARIA, doc.id_action]
            // );
        }

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

module.exports = {
    repairKanc
};
