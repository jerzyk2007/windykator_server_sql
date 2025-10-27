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
        [data.newName, data.company]
      );

      const [result] = await connect_SQL.query(
        `SELECT * FROM company_${info.toLowerCase()}_items`
      );
      return res.json(result);
    } else if (info === "OWNER") {
      await connect_SQL.query(
        `INSERT INTO company_${info.toLowerCase()}_items (${info}, ${info}_MAIL, COMPANY) VALUES (?,?,?)`,
        [data.newName, data.newMail, data.company]
      );
      const [result] = await connect_SQL.query(
        `SELECT * FROM company_${info.toLowerCase()}_items`
      );
      return res.json(result);
    } else if (info === "AGING") {
      await connect_SQL.query(
        `INSERT INTO company_${info.toLowerCase()}_items (FROM_TIME, TO_TIME, TITLE, TYPE) VALUES (?,?,?,?)`,
        [data.FROM_TIME, data.TO_TIME, data.TITLE, data.TYPE]
      );
      const [result] = await connect_SQL.query(
        `SELECT * FROM company_${info.toLowerCase()}_items`
      );
      return res.json(result);
    }
    res.end();
  } catch (error) {
    logEvents(`itemsController, newItem: ${error}`, "reqServerErrors.txt");
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
      "SELECT * from company_area_items"
    );

    const [ownerResult] = await connect_SQL.query(
      "SELECT * FROM company_owner_items"
    );

    const [guardianResult] = await connect_SQL.query(
      "SELECT * from company_guardian_items"
    );

    const [aging] = await connect_SQL.query(
      "SELECT * from company_aging_items"
    );
    const [company] = await connect_SQL.query(
      "SELECT COMPANY from company_settings WHERE id_setting = 1"
    );
    res.json({
      // data: {
      departments: depResult,
      localizations: locResult,
      areas: areaResult,
      owners: ownerResult,
      guardians: guardianResult,
      aging: aging,
      company: company[0].COMPANY || [],
      // },
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
        `DELETE FROM company_${info.toLowerCase()}_items WHERE id_${info.toLowerCase()}_items = ${id}`
      );
    }
    res.end();
  } catch (error) {
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
    } else if (info === "OWNER") {
      await connect_SQL.query(
        `UPDATE  company_${info.toLowerCase()}_items SET ${info} = ?, ${info}_MAIL = ?, COMPANY = ? WHERE id_${info.toLowerCase()}_items = ${id}`,
        [updateData.newName, updateData.newMail, updateData.company]
      );
    } else if (info === "AGING") {
      await connect_SQL.query(
        `UPDATE  company_aging_items SET FROM_TIME = ?, TO_TIME = ?, TITLE = ? WHERE id_aging_items = ?`,
        [updateData.FROM_TIME, updateData.TO_TIME, updateData.TITLE, id]
      );
    }
    res.end();
  } catch (error) {
    console.error(error);
    logEvents(`itemsController, changeItem: ${error}`, "reqServerErrors.txt");
  }
};

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
const getFKSettingsItems = async (req, res) => {
  try {
    const [uniqueDepFromCompanyJI] = await connect_SQL.query(
      "SELECT distinct DEPARTMENT, COMPANY FROM company_join_items"
    );

    const [uniqueDepFromDocuments] = await connect_SQL.query(
      "SELECT distinct DZIAL, FIRMA FROM company_documents"
    );

    const [depResult] = await connect_SQL.query(
      "SELECT DEPARTMENT AS DZIAL, COMPANY AS FIRMA from company_department_items"
    );

    // Tworzymy zbiór kluczy występujących w uniqueDepFromDocuments
    const existingKeys = new Set(
      uniqueDepFromDocuments.map((item) => `${item.DZIAL}_${item.FIRMA}`)
    );

    // Filtrowanie: zostają tylko te, które nie występują w zbiorze
    const manualAddDep = depResult.filter(
      (item) => !existingKeys.has(`${item.DZIAL}_${item.FIRMA}`)
    );

    const [locResult] = await connect_SQL.query(
      "SELECT LOCALIZATION, COMPANY from company_localization_items"
    );

    const [areaResult] = await connect_SQL.query(
      "SELECT AREA, COMPANY from company_area_items"
    );

    const [ownerResult] = await connect_SQL.query(
      "SELECT OWNER, COMPANY from company_owner_items"
    );

    const [guardianResult] = await connect_SQL.query(
      "SELECT GUARDIAN, COMPANY from company_guardian_items"
    );

    // pobieram zapisane wcześniej nazwy oddziałów firmy (KRT, KEM, itd)
    const [company] = await connect_SQL.query(
      "SELECT COMPANY from company_settings WHERE id_setting = 1"
    );

    //pobieram już zapisane wcześniej Itemy
    const [preparedItems] = await connect_SQL.query(
      "SELECT DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN FROM company_join_items ORDER BY DEPARTMENT"
    );
    res.json({
      uniqueDepFromCompanyJI,
      uniqueDepFromDocuments,
      manualAddDep,
      company: company[0]?.company ? company[0].company : [],
      preparedItems,
      companyLoacalizations: locResult,
      companyAreas: areaResult,
      companyOwners: ownerResult,
      companyGuardians: guardianResult,
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
//             "SELECT distinct DZIAL from company_documents"
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
  const { itemData } = req.body;
  try {
    const [duplicate] = await connect_SQL.query(
      "SELECT DEPARTMENT, COMPANY FROM company_join_items WHERE DEPARTMENT = ? AND COMPANY = ?",
      [itemData.department, itemData.company]
    );
    if (duplicate[0]?.DEPARTMENT && duplicate[0]?.COMPANY) {
      await connect_SQL.query(
        "UPDATE company_join_items SET LOCALIZATION = ?, AREA = ?, OWNER = ?, GUARDIAN = ? WHERE DEPARTMENT = ? AND COMPANY = ?",
        [
          itemData.localization,
          itemData.area,
          JSON.stringify(itemData.owner),
          JSON.stringify(itemData.guardian),
          itemData.department,
          itemData.company,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO company_join_items (DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN ) VALUES (?, ?, ?, ?, ?, ?)",
        [
          itemData.department,
          itemData.company,
          itemData.localization,
          itemData.area,
          JSON.stringify(itemData.owner),
          JSON.stringify(itemData.guardian),
        ]
      );
    }
    res.end();
  } catch (error) {
    logEvents(
      `itemsController, savePreparedItems: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const deletePreparedItem = async (req, res) => {
  const { dep, comp } = req.params;
  try {
    await connect_SQL.query(
      "DELETE FROM company_join_items WHERE DEPARTMENT = ? AND COMPANY = ?",
      [dep, comp]
    );
    res.end();
  } catch (error) {
    logEvents(
      `itemsController, deletePreparedItem: ${error}`,
      "reqServerErrors.txt"
    );
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
        `SELECT D.NUMER_FV FROM company_documents AS D
                LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
                WHERE S.NALEZNOSC != 0 AND D.DZIAL  AND D.FIRMA = ?
                LIMIT 1`,
        [dep.DZIAL, dep.FIRMA]
      );
      if (checkPayment[0]?.NUMER_FV) {
        checkDoc.push({
          dep: dep.DZIAL,
          company: dep.FIRMA,
          exist: true,
        });
      } else {
        checkDoc.push({
          dep: dep.DZIAL,
          company: dep.FIRMA,
          manual: dep.manual,
          exist: false,
        });
      }
    }
    res.json({ checkDoc });
  } catch (error) {
    logEvents(
      `itemsController, checkDocPayment: ${error}`,
      "reqServerErrors.txt"
    );
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
  checkDocPayment,
};
