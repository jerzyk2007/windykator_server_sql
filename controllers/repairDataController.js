const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const {
  generatePassword,
  documentsType,
  addDepartment,
} = require("./manageDocumentAddition");
const { accountancyFKData } = require("./sqlQueryForGetDataFromMSSQL");
const { getDataDocuments } = require("./documentsController");

const changeDocumentsTable = async () => {
  try {
    // await connect_SQL.query(
    //   "ALTER TABLE company_documents_actions CHANGE COLUMN UWAGI_ASYSTENT KANAL_KOMUNIKACJI JSON"
    // );
    // await connect_SQL.query(
    //   "ALTER TABLE company_documents_actions ADD COLUMN DZIENNIK_ZMIAN JSON NULL AFTER KANAL_KOMUNIKACJI"
    // );
    // const [result] = await connect_SQL.query(
    //   "SELECT id_action, KANAL_KOMUNIKACJI FROM company_documents_actions WHERE KANAL_KOMUNIKACJI IS NOT NULL   AND JSON_VALID(KANAL_KOMUNIKACJI)   AND JSON_TYPE(KANAL_KOMUNIKACJI) <> 'NULL'   AND (         (JSON_TYPE(KANAL_KOMUNIKACJI) = 'ARRAY'  AND JSON_LENGTH(KANAL_KOMUNIKACJI) > 0)         OR         (JSON_TYPE(KANAL_KOMUNIKACJI) = 'OBJECT' AND JSON_LENGTH(KANAL_KOMUNIKACJI) > 0)      ) "
    // );
    // for (const item of result) {
    //   if (item?.KANAL_KOMUNIKACJI?.length) {
    //     const newItem = item.KANAL_KOMUNIKACJI.map((doc) => {
    //       return {
    //         date: "",
    //         note: doc,
    //         profile: "Pracownik",
    //         username: "",
    //         userlogin: "brak danych",
    //       };
    //     });
    //     await connect_SQL.query(
    //       "UPDATE company_documents_actions SET KANAL_KOMUNIKACJI = ? WHERE id_action = ?",
    //       [JSON.stringify(newItem), item.id_action]
    //     );
    //   }
    // }
    // const [tableColumns] = await connect_SQL.query(
    //   'UPDATE company_table_columns SET ACCESSOR_KEY = "KANAL_KOMUNIKACJI" WHERE ACCESSOR_KEY = "UWAGI_ASYSTENT" AND EMPLOYEE = "Pracownik"'
    // );
    // const [userSettings] = await connect_SQL.query(
    //   "SELECT id_user, tableSettings, columns FROM company_users"
    // );
    // const replaceKey = (key) =>
    //   key === "UWAGI_ASYSTENT" ? "KANAL_KOMUNIKACJI" : key;
    // const updateColumnsPracownik = (pracownik = []) =>
    //   pracownik.map((item) => {
    //     if (item.accessorKey === "UWAGI_ASYSTENT") {
    //       return {
    //         ...item,
    //         accessorKey: "KANAL_KOMUNIKACJI",
    //       };
    //     }
    //     return item;
    //   });
    // const updateTableSettingsPracownik = (pracownik) => {
    //   if (!pracownik) return pracownik;
    //   return {
    //     ...pracownik,
    //     size: Object.fromEntries(
    //       Object.entries(pracownik.size || {}).map(([k, v]) => [
    //         replaceKey(k),
    //         v,
    //       ])
    //     ),
    //     visible: Object.fromEntries(
    //       Object.entries(pracownik.visible || {}).map(([k, v]) => [
    //         replaceKey(k),
    //         v,
    //       ])
    //     ),
    //     order: (pracownik.order || []).map(replaceKey),
    //     pinning: {
    //       ...pracownik.pinning,
    //       left: (pracownik.pinning?.left || []).map(replaceKey),
    //       right: (pracownik.pinning?.right || []).map(replaceKey),
    //     },
    //   };
    // };
    // for (const user of userSettings) {
    //   const { id_user, columns, tableSettings } = user;
    //   // zabezpieczenie
    //   if (!columns?.Pracownik || !tableSettings?.Pracownik) continue;
    //   const updatedColumns = {
    //     ...columns,
    //     Pracownik: updateColumnsPracownik(columns.Pracownik),
    //   };
    //   const updatedTableSettings = {
    //     ...tableSettings,
    //     Pracownik: updateTableSettingsPracownik(tableSettings.Pracownik),
    //   };
    //   await connect_SQL.query(
    //     `
    //       UPDATE company_users
    //       SET columns = ?, tableSettings = ?
    //       WHERE id_user = ?
    //     `,
    //     [
    //       JSON.stringify(updatedColumns),
    //       JSON.stringify(updatedTableSettings),
    //       id_user,
    //     ]
    //   );
    // }
  } catch (error) {
    console.error(error);
  }
};

const changeControlBLTable = async () => {
  try {
    //    await connect_SQL.query(
    //   "ALTER TABLE company_control_documents ADD COLUMN CONTROL_LOGI JSON NULL AFTER CONTROL_UWAGI"
    // );

    const [chatControlBL] = await connect_SQL.query(
      "SELECT id_control_documents, CONTROL_UWAGI FROM company_control_documents"
    );

    for (const item of chatControlBL) {
      if (item?.CONTROL_UWAGI?.length) {
        const newItem = item.CONTROL_UWAGI.map((doc) => {
          return {
            date: "",
            note: doc,
            profile: "Pracownik",
            username: "",
            userlogin: "brak danych",
          };
        });
        // console.log(newItem);
        await connect_SQL.query(
          "UPDATE company_control_documents SET CONTROL_UWAGI = ? WHERE id_control_documents = ?",
          [JSON.stringify(newItem), item.id_control_documents]
        );
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // await changeDocumentsTable();
    // console.log("changeDocumentsTable");
    // await changeControlBLTable();
    // console.log("changeControlBLTable");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
