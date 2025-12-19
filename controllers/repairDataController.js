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
    await connect_SQL.query(
      "ALTER TABLE company_documents_actions CHANGE COLUMN UWAGI_ASYSTENT KANAL_KOMUNIKACJI JSON"
    );
    await connect_SQL.query(
      "ALTER TABLE company_documents_actions ADD COLUMN DZIENNIK_ZMIAN JSON NULL AFTER KANAL_KOMUNIKACJI"
    );
    const [result] = await connect_SQL.query(
      "SELECT id_action, KANAL_KOMUNIKACJI FROM company_documents_actions WHERE KANAL_KOMUNIKACJI IS NOT NULL   AND JSON_VALID(KANAL_KOMUNIKACJI)   AND JSON_TYPE(KANAL_KOMUNIKACJI) <> 'NULL'   AND (         (JSON_TYPE(KANAL_KOMUNIKACJI) = 'ARRAY'  AND JSON_LENGTH(KANAL_KOMUNIKACJI) > 0)         OR         (JSON_TYPE(KANAL_KOMUNIKACJI) = 'OBJECT' AND JSON_LENGTH(KANAL_KOMUNIKACJI) > 0)      ) "
    );
    for (const item of result) {
      if (item?.KANAL_KOMUNIKACJI?.length) {
        const newItem = item.KANAL_KOMUNIKACJI.map((doc) => {
          return {
            date: "",
            note: doc,
            profile: "Pracownik",
            username: "",
            userlogin: "brak danych",
          };
        });
        await connect_SQL.query(
          "UPDATE company_documents_actions SET KANAL_KOMUNIKACJI = ? WHERE id_action = ?",
          [JSON.stringify(newItem), item.id_action]
        );
      }
    }
    const [tableColumns] = await connect_SQL.query(
      'UPDATE company_table_columns SET ACCESSOR_KEY = "KANAL_KOMUNIKACJI" WHERE ACCESSOR_KEY = "UWAGI_ASYSTENT" AND EMPLOYEE = "Pracownik"'
    );
    const [userSettings] = await connect_SQL.query(
      "SELECT id_user, tableSettings, columns FROM company_users"
    );
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
    // mapowanie starych kluczy na nowe

    // zmiany bez kancelaria

    // ======= Pracownik =======
    const keyMapPracownik = {
      UWAGI_ASYSTENT: "KANAL_KOMUNIKACJI",
      "100_VAT": "VAT_100",
      "50_VAT": "VAT_50",
    };

    const replaceKeyPracownik = (key) => keyMapPracownik[key] || key;

    const updateColumnsPracownik = (pracownik = []) =>
      pracownik.map((item) => {
        if (keyMapPracownik[item.accessorKey]) {
          return { ...item, accessorKey: keyMapPracownik[item.accessorKey] };
        }
        return item;
      });

    const updateTableSettingsPracownik = (pracownik) => {
      if (!pracownik) return pracownik;
      return {
        ...pracownik,
        size: Object.fromEntries(
          Object.entries(pracownik.size || {}).map(([k, v]) => [
            replaceKeyPracownik(k),
            v,
          ])
        ),
        visible: Object.fromEntries(
          Object.entries(pracownik.visible || {}).map(([k, v]) => [
            replaceKeyPracownik(k),
            v,
          ])
        ),
        order: (pracownik.order || []).map(replaceKeyPracownik),
        pinning: {
          ...pracownik.pinning,
          left: (pracownik.pinning?.left || []).map(replaceKeyPracownik),
          right: (pracownik.pinning?.right || []).map(replaceKeyPracownik),
        },
      };
    };

    // ======= Kancelaria =======
    const replaceKeyKancelaria = (key) =>
      key === "CZAT_KANCELARIA" ? "KANAL_KOMUNIKACJI" : key;

    const updateColumnsKancelaria = (kancelaria = []) =>
      kancelaria.map((item) => {
        if (item.accessorKey === "CZAT_KANCELARIA") {
          return { ...item, accessorKey: "KANAL_KOMUNIKACJI" };
        }
        return item;
      });

    const updateTableSettingsKancelaria = (kancelaria) => {
      if (!kancelaria) return kancelaria;
      return {
        ...kancelaria,
        size: Object.fromEntries(
          Object.entries(kancelaria.size || {}).map(([k, v]) => [
            replaceKeyKancelaria(k),
            v,
          ])
        ),
        visible: Object.fromEntries(
          Object.entries(kancelaria.visible || {}).map(([k, v]) => [
            replaceKeyKancelaria(k),
            v,
          ])
        ),
        order: (kancelaria.order || []).map(replaceKeyKancelaria),
        pinning: {
          ...kancelaria.pinning,
          left: (kancelaria.pinning?.left || []).map(replaceKeyKancelaria),
          right: (kancelaria.pinning?.right || []).map(replaceKeyKancelaria),
        },
      };
    };

    // ======= Aktualizacja w bazie =======
    for (const user of userSettings) {
      const { id_user, columns, tableSettings } = user;
      if (!columns) continue;

      const updatedColumns = {
        ...columns,
        Pracownik: columns?.Pracownik
          ? updateColumnsPracownik(columns.Pracownik)
          : columns.Pracownik,
        Kancelaria: columns?.Kancelaria
          ? updateColumnsKancelaria(columns.Kancelaria)
          : columns.Kancelaria,
      };

      const updatedTableSettings = {
        ...tableSettings,
        Pracownik: tableSettings?.Pracownik
          ? updateTableSettingsPracownik(tableSettings.Pracownik)
          : tableSettings?.Pracownik,
        Kancelaria: tableSettings?.Kancelaria
          ? updateTableSettingsKancelaria(tableSettings.Kancelaria)
          : tableSettings?.Kancelaria,
      };

      await connect_SQL.query(
        `
      UPDATE company_users
      SET columns = ?, tableSettings = ?
      WHERE id_user = ?
    `,
        [
          JSON.stringify(updatedColumns),
          JSON.stringify(updatedTableSettings),
          id_user,
        ]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const changeControlBLTable = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_control_documents CHANGE COLUMN CONTROL_UWAGI KANAL_KOMUNIKACJI JSON"
    );
    await connect_SQL.query(
      "ALTER TABLE company_control_documents ADD COLUMN DZIENNIK_ZMIAN JSON NULL AFTER KANAL_KOMUNIKACJI"
    );

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

const repairVatColumns = async () => {
  try {
    const [tableColumns] = await connect_SQL.query(
      "SELECT id_table_columns, ACCESSOR_KEY FROM company_table_columns"
    );

    for (const col of tableColumns) {
      if (col.ACCESSOR_KEY === "100_VAT") {
        await connect_SQL.query(
          'UPDATE company_table_columns SET ACCESSOR_KEY = "VAT_100" WHERE id_table_columns = ?',
          [col.id_table_columns]
        );
      } else if (col.ACCESSOR_KEY === "50_VAT") {
        await connect_SQL.query(
          'UPDATE company_table_columns SET ACCESSOR_KEY = "VAT_50" WHERE id_table_columns = ?',
          [col.id_table_columns]
        );
      }
    }

    // const [userSettings] = await connect_SQL.query(
    //   "SELECT id_user, tableSettings, columns FROM company_users"
    // );
    // console.log(userSettings);
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
    // await repairVatColumns();
    // console.log("repairVatColumns");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
