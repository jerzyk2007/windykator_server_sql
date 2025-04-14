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
                `INSERT INTO company_${info.toLowerCase()}_items (${info}, COMPANY) VALUES (?, ?)`,
                [
                    data.newName,
                    data.company,
                ]
            );

            const [result] = await connect_SQL.query(`SELECT * FROM company_${info.toLowerCase()}_items`);
            return res.json(result);
        }
        else if (info === "OWNER") {

            await connect_SQL.query(
                `INSERT INTO company_${info.toLowerCase()}_items (${info}, ${info}_MAIL, COMPANY) VALUES (?,?,?)`,
                [
                    data.newName,
                    data.newMail,
                    data.company
                ]
            );
            const [result] = await connect_SQL.query(`SELECT * FROM company_${info.toLowerCase()}_items`);
            return res.json(result);
        }
        else if (info === "AGING") {
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
            "SELECT * from company_department_items"
        );

        const [locResult] = await connect_SQL.query(
            "SELECT * from company_localization_items"
        );

        const [areaResult] = await connect_SQL.query(
            "SELECT * from company_area_items");

        const [ownerResult] = await connect_SQL.query(
            "SELECT * FROM company_owner_items"
        );

        const [guardianResult] = await connect_SQL.query(
            "SELECT * from company_guardian_items"
        );

        const [aging] = await connect_SQL.query(
            "SELECT * from aging_items"
        );
        const [company] = await connect_SQL.query(
            "SELECT company from settings WHERE id_setting = 1"
        );
        res.json({
            data: {
                departments: depResult,
                localizations: locResult,
                areas: areaResult,
                owners: ownerResult,
                guardians: guardianResult,
                aging: aging,
                company: company
            },
        });
    } catch (error) {
        logEvents(`itemsController, getDataItems: ${error}`, "reqServerErrors.txt");
    }
};

const deleteItem = async (req, res) => {
    const { id, info } = req.params;
    try {
        if (info !== "AGING") {
            await connect_SQL.query(
                `DELETE FROM company_${info.toLowerCase()}_items WHERE id_${info.toLowerCase()}_items = ${id}`
            );
        } else if (info === "AGING") {
            await connect_SQL.query(
                `DELETE FROM ${info.toLowerCase()}_items WHERE id_${info.toLowerCase()}_items = ${id}`
            );
        }
        res.end();
    }
    catch (error) {
        logEvents(`itemsController, deleteItem: ${error}`, "reqServerErrors.txt");
    }
};

const changeItem = async (req, res) => {
    const { id, info } = req.params;
    const { updateData } = req.body;

    try {

        if (info !== "OWNER" && info !== "AGING") {
            await connect_SQL.query(
                `UPDATE  company_${info.toLowerCase()}_items SET ${info} = ?, COMPANY = ? WHERE id_${info.toLowerCase()}_items = ?`,
                [updateData.newName, updateData.company, id]
            );

        }
        else if (info === "OWNER") {

            await connect_SQL.query(
                `UPDATE  company_${info.toLowerCase()}_items SET ${info} = ?, ${info}_MAIL = ?, COMPANY = ? WHERE id_${info.toLowerCase()}_items = ${id}`,
                [updateData.newName,
                updateData.newMail,
                updateData.company
                ]
            );
        }
        else if (info === "AGING") {
            await connect_SQL.query(
                `UPDATE  aging_items SET FROM_TIME = ?, TO_TIME = ?, TITLE = ? WHERE id_aging_items = ?`,
                [
                    updateData.FROM_TIME,
                    updateData.TO_TIME,
                    updateData.TITLE,
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
        // const [uniqueDepFromJI] = await connect_SQL.query(
        //     "SELECT distinct department FROM company_join_items"
        // );

        // const uniqueDepartments = uniqueDepFromJI.map((dep) => {
        //     return dep.department;
        // });

        const [uniqueDepFromCompanyJI] = await connect_SQL.query(
            "SELECT distinct DEPARTMENT, COMPANY FROM company_join_items"
        );

        const [uniqueDepFromDocuments] = await connect_SQL.query(
            "SELECT distinct DZIAL, FIRMA FROM documents"
        );


        // const [depResult] = await connect_SQL.query(
        //     "SELECT DEPARTMENT from company_department_items"
        // );

        // const departments = depResult.map((dep) => {
        //     return dep.DEPARTMENT;
        // });



        const [locResult] = await connect_SQL.query(
            "SELECT LOCALIZATION, COMPANY from company_localization_items"
        );

        //del
        // const localizations = locResult.map((loc) => {
        //     return loc.LOCALIZATION;
        // });

        const [areaResult] = await connect_SQL.query("SELECT AREA, COMPANY from company_area_items");

        //del
        // const areas = areaResult.map((area) => {
        //     return area.AREA;
        // });

        const [ownerResult] = await connect_SQL.query(
            "SELECT OWNER, COMPANY from company_owner_items"
        );

        // del
        // const owners = ownerResult.map((owner) => {
        //     return owner.OWNER;
        // });

        const [guardianResult] = await connect_SQL.query(
            "SELECT GUARDIAN, COMPANY from company_guardian_items"
        );
        // const guardians = guardianResult.map((guardian) => {
        //     return guardian.GUARDIAN;
        // });

        // pobieram zapisane wcześniej nazwy oddziałów firmy (KRT, KEM, itd)
        const [company] = await connect_SQL.query(
            "SELECT company from settings WHERE id_setting = 1"
        );
        //pobieram już zapisane wcześniej Itemy
        const [preparedItems] = await connect_SQL.query(
            "SELECT DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN FROM company_join_items ORDER BY DEPARTMENT"
        );
        res.json({
            // uniqueDepartments,
            uniqueDepFromCompanyJI,
            uniqueDepFromDocuments,
            // departments,
            // areas,
            // localizations,
            // owners,
            // guardians,
            company: company[0]?.company ? company[0].company : [],
            preparedItems,
            companyLoacalizations: locResult,
            companyAreas: areaResult,
            companyOwners: ownerResult,
            companyGuardians: guardianResult
        });
    } catch (error) {
        logEvents(
            `itemsController, getFKSettingsItems: ${error}`,
            "reqServerErrors.txt"
        );
        res.status(500).json({ error: "Server error" });
    }
};


// funkcja pobiera unikalne nazwy działów z tabeli documents
// const getDepfromDocuments = async (req, res) => {
//     try {
//         const [getDepartments] = await connect_SQL.query(
//             "SELECT distinct DZIAL from documents"
//         );

//         const departments = getDepartments.map((dep) => {
//             return dep.DZIAL;
//         });

//         res.json(departments);
//     } catch (error) {
//         logEvents(
//             `itemsController, getDepfromDocuments: ${error}`,
//             "reqServerErrors.txt"
//         );
//         res.status(500).json({ error: "Server error" });
//     }
// };

// funkcja pobierająca kpl owner, dział, lokalizacja dla "Dopasuj dane"
// const getPreparedItems = async (req, res) => {
//     try {
//         const [preparedItems] = await connect_SQL.query(
//             "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
//         );
//         res.json(preparedItems);
//     } catch (error) {
//         logEvents(`itemsController, savePrepareItems: ${error}`, "reqServerErrors.txt");
//         res.status(500).json({ error: "Server error" });
//     }
// };

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
const savePreparedItems = async (req, res) => {
    const { DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN } = req.body;
    try {

        const [duplicate] = await connect_SQL.query(
            "SELECT DEPARTMENT, COMPANY FROM company_join_items WHERE DEPARTMENT = ? AND COMPANY = ?",
            [DEPARTMENT, COMPANY]
        );

        if (duplicate[0]?.DEPARTMENT && duplicate[0]?.COMPANY) {
            await connect_SQL.query(
                "UPDATE company_join_items SET COMPANY = ?, LOCALIZATION = ?, AREA = ?, OWNER = ?, GUARDIAN = ? WHERE DEPARTMENT = ?",
                [
                    COMPANY,
                    LOCALIZATION,
                    AREA,
                    JSON.stringify(OWNER),
                    JSON.stringify(GUARDIAN),
                    DEPARTMENT,
                ]
            );
        } else {
            await connect_SQL.query(
                "INSERT INTO company_join_items (DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN ) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    DEPARTMENT,
                    COMPANY,
                    LOCALIZATION,
                    AREA,
                    JSON.stringify(OWNER),
                    JSON.stringify(GUARDIAN),
                ]
            );
        }
        res.end();
    } catch (error) {
        logEvents(`itemsController, savePrepareItems: ${error}`, "reqServerErrors.txt");
        res.status(500).json({ error: "Server error" });
    }
};

const deletePreparedItem = async (req, res) => {
    const { dep, comp } = req.params;
    try {
        await connect_SQL.query(
            'DELETE FROM company_join_items WHERE DEPARTMENT = ? AND COMPANY = ?', [dep, comp]
        );
        res.end();
    }
    catch (error) {
        logEvents(`itemsController, deletePreparedItem: ${error}`, "reqServerErrors.txt");

    }
};

const checkDocPayment = async (req, res) => {
    const { departments } = req.body;

    try {
        if (!departments.length) {
            return res.json({ checkDoc: [] });
        }

        let checkDoc = [];
        for (const dep of departments) {
            const [checkPayment] = await connect_SQL.query(
                `SELECT D.NUMER_FV FROM documents AS D
                LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV
                WHERE S.NALEZNOSC != 0 AND D.DZIAL = ?
                LIMIT 1`, [dep.DZIAL]);
            if (checkPayment[0]?.NUMER_FV) {
                checkDoc.push({
                    dep: dep.DZIAL,
                    company: dep.FIRMA,
                    exist: true
                });

            } else {
                checkDoc.push({
                    dep: dep.DZIAL,
                    company: dep.FIRMA,
                    exist: false
                });

            }

        }

        res.json({ checkDoc });
    }
    catch (error) {
        logEvents(`itemsController, checkDocPayment: ${error}`, "reqServerErrors.txt");

    }
};

module.exports = {
    newItem,
    getDataItems,
    deleteItem,
    changeItem,
    getFKSettingsItems,
    // getDepfromDocuments,
    // getPreparedItems,
    savePreparedItems,
    deletePreparedItem,
    checkDocPayment
};