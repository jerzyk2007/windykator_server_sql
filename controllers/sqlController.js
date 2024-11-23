const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const User = require("../model/User");
const Setting = require("../model/Setting");
const Document = require("../model/Document");
const { FKRaport } = require("../model/FKRaport");

const copyUsersToMySQL = async (req, res) => {
  try {
    const usersData = await User.find().exec();

    const cleanedData = usersData.map((item) => {
      return {
        username: item.username,
        usersurname: item.usersurname,
        userlogin: item.userlogin,
        roles: item.roles ? item.roles : {},
        password: item.password,
        tableSettings: item.tableSettings ? item.tableSettings : {},
        raportSettings: item.raportSettings ? item.raportSettings : {},
        permissions: item.permissions ? item.permissions : {},
        departments: item.departments ? item.departments : [],
        columns: item.columns ? item.columns : [],
        refreshToken: item.refreshToken ? item.refreshToken : "",
      };
    });

    if (cleanedData.length === 0) {
      console.log("Brak danych do wgrania.");
      return;
    }

    // Pobieramy nazwy kolumn z pierwszego obiektu
    const columns = Object.keys(cleanedData[0]);

    // Budujemy część zapytania SQL z nazwami kolumn
    const sql = `INSERT INTO users (${columns.join(", ")}) VALUES (${columns
      .map(() => "?")
      .join(", ")})`;

    for (const item of cleanedData) {
      // Wyciągamy wartości dla każdej kolumny z obiektu
      const values = columns.map((column) => item[column]);

      // Wykonujemy zapytanie
      await connect_SQL.execute(sql, values);
    }

    console.log("Dane zostały pomyślnie wgrane do bazy danych MySQL.");

    res.json({
      success: true,
      message: "All Users Records",
      // totalUsers: data[0].length,
      data: cleanedData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      succes: false,
      message: "Error in Get All User API",
      error: err,
    });
  }
};
const copySettingsToMySQL = async (req, res) => {
  try {
    const settingsData = await Setting.find().exec();

    const roles = Object.fromEntries(settingsData[0].roles);
    const departments = settingsData[0].departments;
    const columns = settingsData[0].columns;
    const permissions = settingsData[0].permissions;
    const target = settingsData[0].target;

    const [result] = await connect_SQL.query(
      "INSERT INTO settings (roles, departments, columns, permissions, target) VALUES (?, ?, ?, ?, ?)",
      [
        JSON.stringify(roles),
        JSON.stringify(departments),
        JSON.stringify(columns),
        JSON.stringify(permissions),
        JSON.stringify(target),
      ]
    );
    console.log(result);
    // // Budujemy część zapytania SQL z nazwami kolumn
    // const sql = `INSERT INTO users (${columns.join(", ")}) VALUES (${columns
    //   .map(() => "?")
    //   .join(", ")})`;

    // for (const item of cleanedData) {
    //   // Wyciągamy wartości dla każdej kolumny z obiektu
    //   const values = columns.map((column) => item[column]);

    //   // Wykonujemy zapytanie
    //   await connect_SQL.execute(sql, values);
    // }

    // console.log("Dane zostały pomyślnie wgrane do bazy danych MySQL.");

    // res.json({
    //   success: true,
    //   message: "All Users Records",
    //   // totalUsers: data[0].length,
    //   data: cleanedData,
    // });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send({
      succes: false,
      message: "Error in Get All User API",
      error: err,
    });
  }
};
const copyDocumentsToMySQL = async (req, res) => {
  try {
    const result = await Document.find({}).lean();

    const saveToDB = await Promise.all(
      result.map(async (item) => {
        const [duplicate] = await connect_SQL.query(
          "SELECT NUMER_FV FROM documents WHERE NUMER_FV = ?",
          [item.NUMER_FV]
        );
        if (!duplicate.length) {
          await connect_SQL.query(
            "INSERT INTO documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              item.NUMER_FV,
              item.BRUTTO,
              item.NETTO,
              item.DZIAL,
              item.DO_ROZLICZENIA,
              item.DATA_FV,
              item.TERMIN,
              item.KONTRAHENT,
              item.DORADCA,
              item.NR_REJESTRACYJNY,
              item.NR_SZKODY,
              item.UWAGI_Z_FAKTURY[0],
            ]
          );
        } else {
          console.log("duplicate");
        }
      })
    );
    console.log("finish");

    res.end();
  } catch (err) {
    console.error(err);
    res.status(500);
  }
};

const copyDocuments_ActionsToMySQL = async (req, res) => {
  try {
    const result = await Document.find({}).lean();

    const saveToDB = await Promise.all(
      result.map(async (item) => {
        const [duplicate] = await connect_SQL.query(
          "SELECT id_document FROM documents WHERE NUMER_FV = ?",
          [item.NUMER_FV]
        );

        if (duplicate.length) {
          // console.log(duplicate[0].id_document);

          await connect_SQL.query(
            "INSERT INTO documents_actions (document_id , DZIALANIA, JAKA_KANCELARIA, KOMENTARZ_KANCELARIA_BECARED, KWOTA_WINDYKOWANA_BECARED, NUMER_SPRAWY_BECARED, POBRANO_VAT, STATUS_SPRAWY_KANCELARIA, STATUS_SPRAWY_WINDYKACJA, ZAZNACZ_KONTRAHENTA, UWAGI_ASYSTENT, BLAD_DORADCY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              duplicate[0].id_document,
              item.DZIALANIA,
              item.JAKA_KANCELARIA,
              item.KOMENTARZ_KANCELARIA_BECARED,
              item.KWOTA_WINDYKOWANA_BECARED,
              item.NUMER_SPRAWY_BECARED,
              item.POBRANO_VAT,
              item.STATUS_SPRAWY_KANCELARIA,
              item.STATUS_SPRAWY_WINDYKACJA,
              item.ZAZNACZ_KONTRAHENTA,
              JSON.stringify(item.UWAGI_ASYSTENT),
              item.BLAD_DORADCY ? item.BLAD_DORADCY : "NIE",
            ]
          );
        }
      })
    );
    console.log("finish");
    res.end();
    // res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500);
  }
};

const repairDepartments = async (req, res) => {
  try {
    const [documents] = await connect_SQL.query(
      "SELECT id_document, DZIAL FROM documents "
    );
    // Aktualizacja DZIAL dla każdego dokumentu
    const updatedDocuments = documents.map((document) => {
      const match = document.DZIAL.match(/D(\d+)/);
      if (match) {
        const dzialNumber = match[1].padStart(3, "0"); // Dodaj zera do 3 cyfr
        return {
          id_document: document.id_document,
          DZIAL: `D${dzialNumber}`, // Nowy format DZIAL
        };
      }
      return document; // W razie braku dopasowania (co raczej nie wystąpi), zwraca oryginalny dokument
    });

    // Zaktualizuj każdy rekord w bazie danych
    for (const doc of updatedDocuments) {
      await connect_SQL.query(
        "UPDATE documents SET DZIAL = ? WHERE id_document = ?",
        [doc.DZIAL, doc.id_document]
      );
    }

    console.log("Dokumenty zostały zaktualizowane.");
  } catch (err) {
    console.error(err);
  }
};

const copyItemsDepartments = async (req, res) => {
  try {
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0,
          data: "$items",
        },
      },
    ]);
    // console.log(result[0].data.aging);

    for (const dep of result[0].data.departments) {
      console.log(dep);
      // const firstValue = dep.firstValue ? dep.firstValue : null;
      // const secondValue = dep.secondValue ? dep.secondValue : null;
      // await connect_SQL.query(
      //   "INSERT INTO department_items (department) VALUES(?)",
      //   [dep]
      // );
      // const [duplicate] = await connect_SQL.query(
      //   "SELECT guardian from guardian_items WHERE guardian = ?",
      //   [dep]
      // );
      // if (duplicate?.length) {
      //   console.log("jest");
      // } else {
      //   await connect_SQL.query(
      //     "INSERT INTO guardian_items (guardian) VALUES(?)",
      //     [dep]
      //   );
      // }
    }
    console.log("finish");
    res.end();
  } catch (err) {
    console.error(err);
  }
};

const copyPreparedItems = async (req, res) => {
  try {
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedItemsData: 1, // Włączamy tylko pole preparedItemsData
        },
      },
    ]);
    for (const item of result[0].preparedItemsData) {
      await connect_SQL.query(
        "INSERT INTO join_items (department, localization, area, owner, guardian) VALUES (?, ?, ?, ?, ?)",
        [
          item.department,
          item.localization,
          item.area,
          JSON.stringify(item.owner),
          JSON.stringify(item.guardian),
        ]
      );
    }
    console.log("finish");
    res.end();
  } catch (err) {
    console.error(err);
  }
};

// funkcja poprawi kwoty brutto i netto BLACHARNI tylko od fv po 2024-10-01, bez korekt
const fullBruttoFullNetto = async (req, res) => {
  console.log('start');
  try {
    const [documents] = await connect_SQL.query(`SELECT fv.NUMER_FV, fv.BRUTTO, fv.NETTO FROM documents as fv LEFT JOIN join_items as ji ON fv.DZIAL = ji.department WHERE ji.area = 'BLACHARNIA' AND fv.DATA_FV > '2024-09-01' AND fv.NUMER_FV NOT LIKE 'KF%' `);

    for (const doc of documents) {
      const checkDocuments = await msSqlQuery(`
        SELECT 
       fv.[NUMER],
               SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO,
			 SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_NETTO] ELSE 0 END) AS WARTOSC_NETTO   
FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
WHERE fv.[NUMER] = '${doc.NUMER_FV}' AND fv.[NUMER] NOT LIKE 'KF%' 
GROUP BY 
       fv.[NUMER],
       fv.[WARTOSC_NETTO],
       fv.[WARTOSC_BRUTTO]
        `);

      if (doc.NUMER_FV === checkDocuments[0].NUMER && doc.BRUTTO !== checkDocuments[0].WARTOSC_BRUTTO) {
        await connect_SQL.query(
          "UPDATE documents SET BRUTTO = ?, NETTO = ? WHERE NUMER_FV = ?",
          [
            checkDocuments[0].WARTOSC_BRUTTO,
            checkDocuments[0].WARTOSC_NETTO,
            doc.NUMER_FV
          ]
        );
        console.log(doc);
        console.log(checkDocuments[0]);
      }

    }

    console.log('finish');
    res.end();

  }
  catch (err) {
    console.error(err);
  }
};

module.exports = {
  copyUsersToMySQL,
  copySettingsToMySQL,
  copyDocumentsToMySQL,
  copyDocuments_ActionsToMySQL,
  repairDepartments,
  copyItemsDepartments,
  copyPreparedItems,
  fullBruttoFullNetto
};
