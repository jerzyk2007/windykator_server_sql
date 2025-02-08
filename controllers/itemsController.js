const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

// zpobierz dane odpowiednich Items
// const getItems = async (req, res) => {
//     const { info } = req.params;
//     try {
//         let data = [];
//         if (info === 'departments') {
//             const [depResult] = await connect_SQL.query(
//                 "SELECT * from department_items"
//             );
//             return res.json({ departments: depResult });
//         }
//         res.end();
//     }
//     catch (error) {
//         logEvents(
//             `itemsController, getUserItems: ${error}`,
//             "reqServerErrors.txt"
//         );
//     }
// };

//dodanie nowego elementu Item
const newItem = async (req, res) => {
    const { info } = req.params;
    const { data } = req.body;

    try {
        if (info !== "OWNER" && info !== "AGING") {
            await connect_SQL.query(
                `INSERT INTO ${info.toLowerCase()}_items (${info}) VALUES (?)`,
                [
                    data.newName,
                ]
            );
        } else if (info === "OWNER") {

            await connect_SQL.query(
                `INSERT INTO ${info.toLowerCase()}_items (${info}, ${info}_MAIL) VALUES (?,?)`,
                [
                    data.newName,
                    data.newMail,
                ]
            );
        } else if (info === "AGING") {
            await connect_SQL.query(
                `INSERT INTO ${info.toLowerCase()}_items (FROM_TIME, TO_TIME, TITLE, TYPE) VALUES (?,?,?,?)`,
                [
                    data.FROM_TIME,
                    data.TO_TIME,
                    data.TITLE,
                    data.TYPE
                ]
            );
        }
        res.end();
    }
    catch (error) {
        logEvents(
            `itemsController, newItem: ${error}`,
            "reqServerErrors.txt"
        );
    }
};

//funckja odczytująca działy, ownerów, lokalizacje
const getDataItems = async (req, res) => {
    try {
        const [depResult] = await connect_SQL.query(
            "SELECT * from department_items"
        );

        const [locResult] = await connect_SQL.query(
            "SELECT * from localization_items"
        );

        const [areaResult] = await connect_SQL.query(
            "SELECT * from area_items");


        const [ownerResult] = await connect_SQL.query(
            "SELECT * FROM owner_items"
        );


        const [guardianResult] = await connect_SQL.query(
            "SELECT * from guardian_items"
        );


        const [aging] = await connect_SQL.query(
            "SELECT * from aging_items"
        );
        res.json({
            data: {
                departments: depResult,
                localizations: locResult,
                areas: areaResult,
                owners: ownerResult,
                guardians: guardianResult,
                aging: aging,
            },
        });
    } catch (error) {
        logEvents(`itemsController, getDataItems: ${error}`, "reqServerErrors.txt");
    }
};

const deleteItem = async (req, res) => {
    const { id, info } = req.params;
    try {
        await connect_SQL.query(
            `DELETE FROM ${info.toLowerCase()}_items WHERE id_${info.toLowerCase()}_items = ${id}`
        );
        res.end();
    }
    catch (error) {
        logEvents(`itemsController, deleteItem: ${error}`, "reqServerErrors.txt");
    }
};

const changeItem = async (req, res) => {
    const { id, info } = req.params;
    const { data } = req.body;

    try {
        if (info !== "OWNER" && info !== "AGING") {
            await connect_SQL.query(
                `UPDATE  ${info.toLowerCase()}_items SET ${info} = ? WHERE id_${info.toLowerCase()}_items = ${id}`,
                [data.newName]
            );
        } else if (info === "OWNER") {

            await connect_SQL.query(
                `UPDATE  ${info.toLowerCase()}_items SET ${info} = ?, ${info}_MAIL = ? WHERE id_${info.toLowerCase()}_items = ${id}`,
                [data.newName,
                data.newMail
                ]
            );
        } else if (info === "AGING") {
            await connect_SQL.query(
                `UPDATE  aging_items SET FROM_TIME = ?, TO_TIME = ?, TITLE = ? WHERE id_aging_items = ?`,
                [
                    data.FROM_TIME,
                    data.TO_TIME,
                    data.TITLE,
                    id
                ]
            );
        }
        res.end();
    }
    catch (error) {
        console.error(error);
        logEvents(`itemsController, changeItem: ${error}`, "reqServerErrors.txt");
    }
};

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
const getFKSettingsItems = async (req, res) => {
    try {
        const [uniqeDepFromJI] = await connect_SQL.query(
            "SELECT distinct department FROM join_items"
        );

        const uniqueDepartments = uniqeDepFromJI.map((dep) => {
            return dep.department;
        });

        const [depResult] = await connect_SQL.query(
            "SELECT DEPARTMENT from department_items"
        );

        const departments = depResult.map((dep) => {
            return dep.DEPARTMENT;
        });

        const [locResult] = await connect_SQL.query(
            "SELECT LOCALIZATION from localization_items"
        );
        const localizations = locResult.map((loc) => {
            return loc.LOCALIZATION;
        });

        const [areaResult] = await connect_SQL.query("SELECT AREA from area_items");
        const areas = areaResult.map((area) => {
            return area.AREA;
        });

        const [ownerResult] = await connect_SQL.query(
            "SELECT OWNER from owner_items"
        );
        const owners = ownerResult.map((owner) => {
            return owner.OWNER;
        });

        const [guardianResult] = await connect_SQL.query(
            "SELECT GUARDIAN from guardian_items"
        );
        const guardians = guardianResult.map((guardian) => {
            return guardian.GUARDIAN;
        });
        res.json({
            uniqueDepartments,
            departments,
            areas,
            localizations,
            owners,
            guardians,
        });
    } catch (error) {
        logEvents(
            `itemsController, getFKSettingsItems: ${error}`,
            "reqServerErrors.txt"
        );
        res.status(500).json({ error: "Server error" });
    }
};


// funkcja pobiera unikalne nazwy działów z pliku księgowego
const getDepfromDocuments = async (req, res) => {
    try {
        const [getDepartments] = await connect_SQL.query(
            "SELECT distinct DZIAL from documents"
        );

        const departments = getDepartments.map((dep) => {
            return dep.DZIAL;
        });

        res.json(departments);
    } catch (error) {
        logEvents(
            `itemsController, getDepfromAccountancy: ${error}`,
            "reqServerErrors.txt"
        );
        res.status(500).json({ error: "Server error" });
    }
};

// funkcja pobierająca kpl owner, dział, lokalizacja dla "Dopasuj dane"
const getPreparedItems = async (req, res) => {
    try {
        const [preparedItems] = await connect_SQL.query(
            "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
        );
        res.json(preparedItems);
    } catch (error) {
        logEvents(`itemsController, savePrepareItems: ${error}`, "reqServerErrors.txt");
        res.status(500).json({ error: "Server error" });
    }
};

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
const savePreparedItems = async (req, res) => {
    const { department, localization, area, owner, guardian } = req.body;
    try {
        const [duplicate] = await connect_SQL.query(
            "SELECT department FROM join_items WHERE department = ?",
            [department]
        );
        if (duplicate[0]?.department) {
            await connect_SQL.query(
                "UPDATE join_items SET localization = ?, area = ?, owner = ?, guardian = ? WHERE department = ?",
                [
                    localization,
                    area,
                    JSON.stringify(owner),
                    JSON.stringify(guardian),
                    department,
                ]
            );
        } else {
            await connect_SQL.query(
                "INSERT INTO join_items (department, localization, area, owner, guardian) VALUES (?, ?, ?, ?, ?)",
                [
                    department,
                    localization,
                    area,
                    JSON.stringify(owner),
                    JSON.stringify(guardian),
                ]
            );
        }
        res.end();
    } catch (error) {
        logEvents(`itemsController, savePrepareItems: ${error}`, "reqServerErrors.txt");
        res.status(500).json({ error: "Server error" });
    }
};


module.exports = {
    newItem,
    getDataItems,
    deleteItem,
    changeItem,
    getFKSettingsItems,
    getDepfromDocuments,
    getPreparedItems,
    savePreparedItems
};