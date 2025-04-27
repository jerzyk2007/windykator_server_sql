const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { addDepartment } = require('./manageDocumentAddition');


const companyAgingItems = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.aging_items`);

        await connect_SQL.query('TRUNCATE company_aging_items');

        for (item of result) {
            await connect_SQL.query(`INSERT INTO company_aging_items (FROM_TIME, TO_TIME, TITLE, TYPE) VALUES (?, ?, ?, ?)`,
                [item.FROM_TIME, item.TO_TIME, item.TITLE, item.TYPE]
            );
        }
    }
    catch (err) {
        console.error(err);
    }
};

const companyAreaItems = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.area_items`);

        await connect_SQL.query('TRUNCATE company_area_items');

        for (item of result) {
            await connect_SQL.query(`INSERT INTO company_area_items (AREA, COMPANY) VALUES (?, ?)`,
                [item.AREA, 'ALL']
            );
        }
    }
    catch (err) {
        console.error(err);
    }
};

const companyControlDocuments = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.control_documents`);
        await connect_SQL.query('TRUNCATE company_control_documents');

        const values = result.map(item => [
            item.NUMER_FV,
            item.CONTROL_UPOW,
            item.CONTROL_OSW_VAT,
            item.CONTROL_PR_JAZ,
            item.CONTROL_DOW_REJ,
            item.CONTROL_POLISA,
            item.CONTROL_DECYZJA,
            item.CONTROL_FV,
            item.CONTROL_ODPOWIEDZIALNOSC,
            item.CONTROL_PLATNOSC_VAT,
            JSON.stringify(item.CONTROL_UWAGI),
            'KRT'
        ]);

        const query = `
            INSERT IGNORE INTO company_control_documents 
              (NUMER_FV, CONTROL_UPOW, CONTROL_OSW_VAT, CONTROL_PR_JAZ, CONTROL_DOW_REJ, CONTROL_POLISA, CONTROL_DECYZJA, CONTROL_FV, CONTROL_ODPOWIEDZIALNOSC, CONTROL_PLATNOSC_VAT, CONTROL_UWAGI, COMPANY) 
            VALUES 
              ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
          `;
        await connect_SQL.query(query, values.flat());

    }
    catch (err) {
        console.error(err);
    }
};

const companyDepartmentItems = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.department_items`);

        await connect_SQL.query('TRUNCATE company_department_items');

        for (item of result) {
            await connect_SQL.query(`INSERT INTO company_department_items (DEPARTMENT, COMPANY) VALUES (?, ?)`,
                [item.DEPARTMENT, 'KRT']
            );
        }
    }
    catch (err) {
        console.error(err);
    }
};

const BATCH_SIZE = 10000;

const batchInsert = async (queryPrefix, values, chunkSize) => {
    for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        const placeholders = chunk.map(row => `(${row.map(() => '?').join(', ')})`).join(', ');
        const query = `${queryPrefix} VALUES ${placeholders}`;
        await connect_SQL.query(query, chunk.flat());
        console.log(`✅ Wstawiono batch ${i / chunkSize + 1} (${chunk.length} rekordów)`);
    }
};



const copyDocumentsAndActions = async () => {
    try {
        const [documents] = await connect_SQL.query(`SELECT * FROM windykacja.documents`);
        const [actions] = await connect_SQL.query(`SELECT * FROM windykacja.documents_actions`);

        await connect_SQL.query('SET FOREIGN_KEY_CHECKS = 0');
        await connect_SQL.query('TRUNCATE company_documents');
        await connect_SQL.query('TRUNCATE company_documents_actions');

        const docValues = documents.map(item => [
            item.id_document,
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
            item.UWAGI_Z_FAKTURY,
            item.TYP_PLATNOSCI,
            item.NIP,
            item.VIN,
            item.NR_AUTORYZACJI,
            item.KOREKTA,
            'KRT'
        ]);

        const docPlaceholder = "id_document, NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA";
        await batchInsert(`INSERT INTO company_documents (${docPlaceholder})`, docValues, BATCH_SIZE);

        const actValues = actions.map(item => [
            item.id_action,
            item.document_id,  // Odwołuje się do id_document w company_documents
            item.DZIALANIA,
            item.KOMENTARZ_KANCELARIA_BECARED,
            item.KWOTA_WINDYKOWANA_BECARED,
            item.NUMER_SPRAWY_BECARED,
            item.POBRANO_VAT,
            item.STATUS_SPRAWY_KANCELARIA,
            item.STATUS_SPRAWY_WINDYKACJA,
            item.ZAZNACZ_KONTRAHENTA,
            JSON.stringify(item.UWAGI_ASYSTENT),
            item.BLAD_DORADCY,
            item.DATA_KOMENTARZA_BECARED,
            item.DATA_WYDANIA_AUTA,
            item.OSTATECZNA_DATA_ROZLICZENIA,
            item.JAKA_KANCELARIA_TU,
            JSON.stringify(item.HISTORIA_ZMIANY_DATY_ROZLICZENIA),
            JSON.stringify(item.INFORMACJA_ZARZAD),
        ]);

        const actPlaceholder = "id_action, document_id, DZIALANIA, KOMENTARZ_KANCELARIA_BECARED, KWOTA_WINDYKOWANA_BECARED, NUMER_SPRAWY_BECARED, POBRANO_VAT, STATUS_SPRAWY_KANCELARIA, STATUS_SPRAWY_WINDYKACJA, ZAZNACZ_KONTRAHENTA, UWAGI_ASYSTENT, BLAD_DORADCY, DATA_KOMENTARZA_BECARED, DATA_WYDANIA_AUTA, OSTATECZNA_DATA_ROZLICZENIA, JAKA_KANCELARIA_TU, HISTORIA_ZMIANY_DATY_ROZLICZENIA, INFORMACJA_ZARZAD";
        await batchInsert(`INSERT INTO company_documents_actions (${actPlaceholder})`, actValues, BATCH_SIZE);


        await connect_SQL.query('SET FOREIGN_KEY_CHECKS = 1');
        // console.log('✅ Kopiowanie zakończone pomyślnie!');
    } catch (err) {
        console.error('❌ Błąd podczas kopiowania:', err);
    }
};

const companyFVZaliczk = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.fv_zaliczkowe`);
        await connect_SQL.query('TRUNCATE company_fv_zaliczkowe');

        const values = result.map(item => [
            item.NUMER_FV,
            item.FV_ZALICZKOWA,
            item.KWOTA_BRUTTO,
            'KRT'
        ]);

        const query = `
            INSERT IGNORE INTO company_fv_zaliczkowe 
              (NUMER_FV, FV_ZALICZKOWA, KWOTA_BRUTTO, COMPANY) 
            VALUES 
              ${values.map(() => "(?, ?, ?, ?)").join(", ")}
          `;
        await connect_SQL.query(query, values.flat());

    }
    catch (err) {
        console.error(err);
    }
};

const companyGuardianItems = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.guardian_items`);

        await connect_SQL.query('TRUNCATE company_guardian_items');

        for (item of result) {
            await connect_SQL.query(`INSERT INTO company_guardian_items (GUARDIAN, COMPANY) VALUES (?, ?)`,
                [item.GUARDIAN, 'KRT']
            );
        }
    }
    catch (err) {
        console.error(err);
    }
};


const companyHistoryManagement = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.history_fk_documents`);
        await connect_SQL.query('TRUNCATE company_history_management');

        const values = result.map(item => [
            item.NUMER_FV,
            JSON.stringify(item.HISTORY_DOC),
            'KRT'
        ]);

        const query = `
            INSERT IGNORE INTO company_history_management 
              (NUMER_FV, HISTORY_DOC, COMPANY) 
            VALUES 
              ${values.map(() => "(?, ?,  ?)").join(", ")}
          `;
        await connect_SQL.query(query, values.flat());

    }
    catch (err) {
        console.error(err);
    }
};

const companyJoinItems = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.join_items`);
        await connect_SQL.query('TRUNCATE company_join_items');

        const values = result.map(item => [
            item.department,
            'KRT',
            item.localization,
            item.area,
            JSON.stringify(item.owner),
            JSON.stringify(item.guardian),
        ]);

        const query = `
            INSERT IGNORE INTO company_join_items 
              (DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN) 
            VALUES 
              ${values.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}
          `;
        await connect_SQL.query(query, values.flat());

    }
    catch (err) {
        console.error(err);
    }
};


const companyLocalizationItems = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.localization_items`);

        await connect_SQL.query('TRUNCATE company_localization_items');

        for (item of result) {
            await connect_SQL.query(`INSERT INTO company_localization_items (LOCALIZATION, COMPANY) VALUES (?, ?)`,
                [item.LOCALIZATION, 'KRT']
            );
        }
    }
    catch (err) {
        console.error(err);
    }
};

const companyManagementDateDescriptionFK = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.management_decision_FK`);


        const groupedMap = new Map();

        for (const item of result) {
            const key = `${item.NUMER_FV}|${item.WYKORZYSTANO_RAPORT_FK}`;

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    NUMER_FV: item.NUMER_FV,
                    WYKORZYSTANO_RAPORT_FK: item.WYKORZYSTANO_RAPORT_FK,
                    INFORMACJA_ZARZAD: [],
                    HISTORIA_ZMIANY_DATY_ROZLICZENIA: [],
                });
            }

            const group = groupedMap.get(key);

            if (item.INFORMACJA_ZARZAD) {
                group.INFORMACJA_ZARZAD.push(item.INFORMACJA_ZARZAD);
            }

            if (item.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
                group.HISTORIA_ZMIANY_DATY_ROZLICZENIA.push(item.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
            }
        }

        const groupedResult = Array.from(groupedMap.values());

        await connect_SQL.query('TRUNCATE company_management_date_description_FK');

        const values = groupedResult.map(item => [
            item.NUMER_FV,
            JSON.stringify(item.HISTORIA_ZMIANY_DATY_ROZLICZENIA),
            JSON.stringify(item.INFORMACJA_ZARZAD),
            item.WYKORZYSTANO_RAPORT_FK,
            'KRT',
        ]);

        const query = `
            INSERT IGNORE INTO company_management_date_description_FK 
              (NUMER_FV, HISTORIA_ZMIANY_DATY_ROZLICZENIA, INFORMACJA_ZARZAD, WYKORZYSTANO_RAPORT_FK, COMPANY) 
            VALUES 
              ${values.map(() => "(?, ?, ?, ?, ?)").join(", ")}
          `;
        await connect_SQL.query(query, values.flat());

    }
    catch (err) {
        console.error(err);
    }
};



const companyMarkDocuments = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.mark_documents`);

        await connect_SQL.query('TRUNCATE company_mark_documents');

        for (item of result) {
            await connect_SQL.query(`INSERT INTO company_mark_documents (NUMER_FV, COMPANY, RAPORT_FK) VALUES (?, ?, ?)`,
                [item.NUMER_FV, 'KRT', item.RAPORT_FK]
            );
        }
    }
    catch (err) {
        console.error(err);
    }
};


const companyOwnerItems = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.owner_items`);

        await connect_SQL.query('TRUNCATE company_owner_items');

        for (item of result) {
            await connect_SQL.query(`INSERT INTO company_owner_items (OWNER, OWNER_MAIL, COMPANY) VALUES (?, ?, ?)`,
                [item.OWNER, item.OWNER_MAIL, 'KRT']
            );
        }
    }
    catch (err) {
        console.error(err);
    }
};

const companyFKRaportKRT = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.fk_raport_v2`);
        await connect_SQL.query('TRUNCATE company_fk_raport_KRT');

        const values = result.map(item => [
            item.BRAK_DATY_WYSTAWIENIA_FV,
            item.CZY_SAMOCHOD_WYDANY_AS,
            item.CZY_W_KANCELARI,
            item.DATA_ROZLICZENIA_AS,
            item.DATA_WYDANIA_AUTA,
            item.DATA_WYSTAWIENIA_FV,
            item.DO_ROZLICZENIA_AS,
            item.DZIAL,
            item.ETAP_SPRAWY,
            item.HISTORIA_ZMIANY_DATY_ROZLICZENIA,
            item.ILE_DNI_NA_PLATNOSC_FV,
            JSON.stringify(item.INFORMACJA_ZARZAD),
            item.JAKA_KANCELARIA,
            item.KONTRAHENT,
            item.KWOTA_DO_ROZLICZENIA_FK,
            item.KWOTA_WPS,
            item.LOKALIZACJA,
            item.NR_DOKUMENTU,
            item.DORADCA,
            item.NR_KLIENTA,
            item.OBSZAR,
            JSON.stringify(item.OPIEKUN_OBSZARU_CENTRALI),
            JSON.stringify(item.OPIS_ROZRACHUNKU),
            item.OSTATECZNA_DATA_ROZLICZENIA,
            JSON.stringify(item.OWNER),
            item.PRZEDZIAL_WIEKOWANIE,
            item.RODZAJ_KONTA,
            item.ROZNICA,
            item.TERMIN_PLATNOSCI_FV,
            item.TYP_DOKUMENTU,
            item.VIN,
            "KRT"
        ]);

        const query = `
            INSERT IGNORE INTO company_fk_raport_KRT 
              (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DZIAL, ETAP_SPRAWY, HISTORIA_ZMIANY_DATY_ROZLICZENIA, ILE_DNI_NA_PLATNOSC_FV, INFORMACJA_ZARZAD, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, DORADCA, NR_KLIENTA, OBSZAR, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OSTATECZNA_DATA_ROZLICZENIA, OWNER, PRZEDZIAL_WIEKOWANIE, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU, VIN, FIRMA) 
            VALUES 
              ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
          `;
        await connect_SQL.query(query, values.flat());

    }
    catch (err) {
        console.error(err);
    }
};

const companyraportFKKRTAccountancy = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.raportFK_accountancy`);
        await connect_SQL.query('TRUNCATE company_raportFK_KRT_accountancy');

        const values = result.map(item => [
            item.NUMER_FV,
            item.KONTRAHENT,
            item.NR_KONTRAHENTA,
            item.DO_ROZLICZENIA,
            item.TERMIN_FV,
            item.KONTO,
            item.TYP_DOKUMENTU,
            item.DZIAL,
            "KRT"
        ]);

        const query = `
            INSERT IGNORE INTO company_raportFK_KRT_accountancy 
              (NUMER_FV, KONTRAHENT, NR_KONTRAHENTA, DO_ROZLICZENIA, TERMIN_FV, KONTO, TYP_DOKUMENTU, DZIAL, FIRMA) 
            VALUES 
              ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
          `;
        await connect_SQL.query(query, values.flat());

    }
    catch (err) {
        console.error(err);
    }
};

const companyUsers = async () => {
    try {
        const [result] = await connect_SQL.query(`SELECT * FROM windykacja.users`);
        await connect_SQL.query('TRUNCATE company_users');

        const updateDeps = result.map(doc => {
            const departments = doc?.departments ? [...doc.departments] : [];
            const newDeps = departments.map(item => {
                return {
                    company: 'KRT',
                    department: item
                };
            });
            return {
                ...doc,
                departments: [...newDeps]
            };
        });

        for (updateDoc of updateDeps) {
            await connect_SQL.query(`INSERT INTO company_users (username, usersurname, userlogin, roles, password, tableSettings, raportSettings, permissions, departments, columns, refreshToken) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [updateDoc.username, updateDoc.usersurname, updateDoc.userlogin, JSON.stringify(updateDoc.roles), updateDoc.password, JSON.stringify(updateDoc.tableSettings), JSON.stringify(updateDoc.raportSettings), JSON.stringify(updateDoc.permissions), JSON.stringify(updateDoc.departments), JSON.stringify(updateDoc.columns), updateDoc.refreshToken]
            );
        }

    }
    catch (err) {
        console.error(err);
    }
};

const addDocumentKEMToDatabase = async (firma, twoDaysAgo) => {
    const formatDate = (date) => {
        if (date instanceof Date) {
            return date.toISOString().split('T')[0]; // Wyciąga tylko część daty, np. "2024-11-08"
        }
        return date;
    };

    const queryKEM = `SELECT 
  fv.[NUMER],
   CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23) AS DATA_WYSTAWIENIA,
  CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23) AS DATA_ZAPLATA,
  fv.[KONTR_NAZWA],
  fv.[KONTR_NIP],
  SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO,
  SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_NETTO] ELSE 0 END) AS WARTOSC_NETTO,
  fv.[NR_SZKODY],
  fv.[NR_AUTORYZACJI],
  fv.[UWAGI],
  fv.[KOREKTA_NUMER],
  zap.[NAZWA] AS TYP_PLATNOSCI,
  us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL,
  auto.[REJESTRACJA],
  auto.[NR_NADWOZIA],
  tr.[WARTOSC_NAL]
  FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC] AS fv
  LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
  LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
  LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
  LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[AUTO] AS auto ON fv.AUTO_ID = auto.AUTO_ID
  LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
  WHERE fv.[NUMER] != 'POTEM' 
  AND fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}'
  GROUP BY 
  fv.[NUMER],
  CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23),
  CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23),
      fv.[KONTR_NAZWA],
  fv.[KONTR_NIP],
  fv.[NR_SZKODY],
  fv.[NR_AUTORYZACJI],
  fv.[UWAGI],
  fv.[KOREKTA_NUMER],
  zap.[NAZWA],
  us.[NAZWA] + ' ' + us.[IMIE],
  auto.[REJESTRACJA],
  auto.[NR_NADWOZIA],
  tr.[WARTOSC_NAL];
  `;

    try {
        const documents = await msSqlQuery(queryKEM);
        // dodaje nazwy działów
        const addDep = addDepartment(documents);

        addDep.forEach(row => {
            row.DATA_WYSTAWIENIA = formatDate(row.DATA_WYSTAWIENIA);
            row.DATA_ZAPLATA = formatDate(row.DATA_ZAPLATA);
        });

        const values = addDep.map(item => [
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
            item.UWAGI_Z_FAKTURY,
            item.TYP_PLATNOSCI,
            item.NIP,
            item.VIN,
            item.NR_AUTORYZACJI,
            item.KOREKTA,
            firma
        ]);

        const querySQL = `
            INSERT IGNORE INTO company_documents 
              (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA) 
            VALUES 
              ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
          `;
        await connect_SQL.query(querySQL, values.flat());
        // for (const doc of addDep) {

        //     await connect_SQL.query(
        //         "INSERT IGNORE INTO company_documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        //         [
        //             doc.NUMER,
        //             doc.WARTOSC_BRUTTO,
        //             doc.WARTOSC_NETTO,
        //             doc.DZIAL,
        //             doc.WARTOSC_NAL || 0,
        //             doc.DATA_WYSTAWIENIA,
        //             doc.DATA_ZAPLATA,
        //             doc.KONTR_NAZWA,
        //             doc.PRZYGOTOWAL ? doc.PRZYGOTOWAL : "Brak danych",
        //             doc.REJESTRACJA,
        //             doc.NR_SZKODY || null,
        //             doc.UWAGI,
        //             doc.TYP_PLATNOSCI,
        //             doc.KONTR_NIP || null,
        //             doc.NR_NADWOZIA,
        //             doc.NR_AUTORYZACJI || null,
        //             doc.KOREKTA_NUMER,
        //             firma
        //         ]
        //     );
        // }
    }
    catch (error) {
        console.error(error);
    }
};

const copyDbtoDB = async () => {
    try {
        // console.log('✅ companyAgingItems');
        // await companyAgingItems();

        // console.log('✅ companyAreaItems');
        // await companyAreaItems();

        // console.log('✅ companyControlDocuments');
        // await companyControlDocuments();

        // console.log('✅ companyDepartmentItems');
        // await companyDepartmentItems();

        // console.log('✅ copyDocumentsAndActions');
        // await copyDocumentsAndActions();

        // console.log('✅ companyFVZaliczk');
        // await companyFVZaliczk();

        // console.log('✅ companyGuardianItems');
        // await companyGuardianItems();

        // console.log('✅ companyHistoryManagement');
        // await companyHistoryManagement();

        // console.log('✅ companyJoinItems');
        // await companyJoinItems();

        // console.log('✅ companyLocalizationItems');
        // await companyLocalizationItems();

        // console.log('✅ companyManagementDateDescriptionFK');
        // await companyManagementDateDescriptionFK();

        // console.log('✅ companyMarkDocuments');
        // await companyMarkDocuments();

        // console.log('✅ companyOwnerItems');
        // await companyOwnerItems();

        // console.log('✅ companyFKRaportKRT');
        // await companyFKRaportKRT();

        // console.log('✅ companyraportFKKRTAccountancy');
        // await companyraportFKKRTAccountancy();

        // console.log('✅ companyUsers');
        // await companyUsers();

        // console.log('✅ addDocumentKEMToDatabase');
        // await addDocumentKEMToDatabase('KEM', '2024-01-01');


        console.log('koniec');
    }
    catch (err) {
        console.error(err);
    }
};

module.exports = {
    copyDbtoDB,
};
