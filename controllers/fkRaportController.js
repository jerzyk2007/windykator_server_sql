const { connect_SQL } = require("../config/dbConn");
const { checkDate, checkTime } = require('./manageDocumentAddition');
const { documentsType } = require('./manageDocumentAddition');


const { logEvents } = require("../middleware/logEvents");

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika - wersja 1 - będzie niebawem usuwana
const getRaportData = async (req, res) => {
  try {
    const [dataRaport] = await connect_SQL.query('SELECT * FROM fk_raport');
    //usuwam z każdego obiektu klucz id_fk_raport
    dataRaport.forEach(item => {
      delete item.id_fk_raport;
    });

    res.json(dataRaport);
  } catch (error) {
    logEvents(`fkRaportController, getRaportData: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// do wyszukiwania różnic pomiędzy FK a AS
const differencesAS_FK = async () => {
  try {
    //pobieram wszytskie numery faktur z programu
    const [docAS] = await connect_SQL.query(`SELECT D.NUMER_FV FROM documents AS D LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV WHERE S.NALEZNOSC !=0`);
    const fvAS = docAS.map(item => item.NUMER_FV);

    const [docFK] = await connect_SQL.query(`SELECT NR_DOKUMENTU FROM fk_raport_v2`);
    const fvFK = docFK.map(item => item.NR_DOKUMENTU);

    const filteredFvAS = fvAS.filter(fv => !fvFK.includes(fv));

    const sqlCondition = filteredFvAS?.length > 0 ? `(${filteredFvAS.map(dep => `D.NUMER_FV = '${dep}'`).join(' OR ')})` : null;

    const [getDoc] = await connect_SQL.query(
      `SELECT D.NUMER_FV AS NR_DOKUMENTU, D.DZIAL, IFNULL(JI.localization, 'BRAK DANYCH') AS LOKALIZACJA, D.KONTRAHENT, S.NALEZNOSC AS DO_ROZLICZENIA_AS, 
      D.DATA_FV AS DATA_WYSTAWIENIA_FV, D.TERMIN AS TERMIN_PLATNOSCI_FV,
      IFNULL(JI.area, 'BRAK DANYCH') AS OBSZAR, IFNULL(JI.guardian, 'BRAK DANY') AS OPIEKUN_OBSZARU_CENTRALI, 
      IFNULL(JI.owner,  'BRAK DANY') AS OWNER
      FROM documents AS D 
      LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV 
      LEFT JOIN join_items AS JI ON D.DZIAL = JI.department
      WHERE S.NALEZNOSC !=0 AND ${sqlCondition}`
    );

    const safeParseJSON = (data) => {
      try {
        return data ? JSON.parse(data) : data;
      } catch (error) {
        return data; // Zwraca oryginalną wartość, jeśli parsowanie się nie powiodło
      }
    };

    const addDocType = getDoc.map(item => {
      return {
        ...item,
        TYP_DOKUMENTU: documentsType(item.NR_DOKUMENTU),
        OWNER: safeParseJSON(item.OWNER),
        OPIEKUN_OBSZARU_CENTRALI: safeParseJSON(item.OPIEKUN_OBSZARU_CENTRALI)
      };
    });

    return addDocType;
  }
  catch (error) {
    logEvents(`fkRaportController, differencesAS_FK: ${error}`, "reqServerErrors.txt");
    return [];
  }
};

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika, wersja poprawiona
const getRaportDataV2 = async (req, res) => {
  try {
    const [dataRaport] = await connect_SQL.query('SELECT HFD.HISTORY_DOC AS HISTORIA_WPISOW, FK_V2.* FROM fk_raport_v2 AS FK_V2 LEFT JOIN history_fk_documents AS HFD ON FK_V2.NR_DOKUMENTU = HFD.NUMER_FV');
    //usuwam z każdego obiektu klucz id_fk_raport
    dataRaport.forEach(item => {
      delete item.id_fk_raport;
    });


    const getDifferencesFK_AS = await differencesAS_FK();

    res.json({ dataRaport, differences: getDifferencesFK_AS });
    // res.json([]);
  } catch (error) {
    logEvents(`fkRaportController, getRaportDataV2: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// pobieram daty  aktualizacji plików excel dla raportu FK !!!
const getDateCounter = async (req, res) => {
  try {
    const [result] = await connect_SQL.query('SELECT title, date, counter FROM fk_updates_date');

    const jsonObject = result.reduce((acc, item) => {
      acc[item.title] = {
        date: item.date,    // Przypisanie `date` jako `hour`
        counter: item.counter
      };
      return acc;
    }, {});

    res.json({ updateData: jsonObject });
  } catch (error) {
    logEvents(
      `fkRaportController, getDateCounter: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

//funckja kasuje przygotwane dane do raportu, czas dodania pliki i ilość danych
const deleteDataRaport = async (req, res) => {
  try {
    await connect_SQL.query('TRUNCATE fk_updates_date');
    await connect_SQL.query('TRUNCATE raportFK_accountancy');

    res.json({ result: "delete" });
  } catch (error) {
    logEvents(
      `fkRaportController, deleteDataRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// generowanie raportu wersji 1 i zapisanie do bazy danych
const generateRaport = async (req, res) => {
  try {
    const [getData] = await connect_SQL.query('SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS FROM raportFK_accountancy AS RA LEFT JOIN join_items AS JI ON RA.DZIAL = JI.department LEFT JOIN documents AS D ON RA.NUMER_FV = D.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN rubicon_raport_fk AS R ON RA.NUMER_FV = R.NUMER_FV LEFT JOIN settlements AS S ON RA.NUMER_FV = S.NUMER_FV LEFT JOIN settlements_description AS SD ON RA.NUMER_FV = SD.NUMER ');

    const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM aging_items');

    // jeśli nie ma DATA_FV to od TERMIN_FV jest odejmowane 14 dni
    const changeDate = (dateStr) => {
      const date = new Date(dateStr);
      // Odejmij 14 dni
      date.setDate(date.getDate() - 14);
      // Przekonwertuj datę na format 'YYYY-MM-DD'
      const updatedDate = date.toISOString().split('T')[0];
      return updatedDate;
    };

    // odejmuje TERMIN_FV od DATA_FV
    const howManyDays = (DATA_FV, TERMIN_FV) => {
      // Konwersja dat w formacie yyyy-mm-dd na obiekty Date
      const date1 = new Date(DATA_FV);
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date2 - date1;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      return differenceInDays;
    };

    // sprawdza czy fv jest przeterminowana czy nieprzeterminowana
    const isOlderThanToday = (TERMIN_FV) => {
      // Konwersja TERMIN_FV na obiekt Date
      const terminDate = new Date(TERMIN_FV);
      // Pobranie dzisiejszej daty bez czasu (tylko yyyy-mm-dd)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerowanie godziny, minuty, sekundy, milisekundy
      return terminDate < today;
    };

    // przypisywanie przedziału wiekowania

    const checkAging = (TERMIN_FV) => {
      const date1 = new Date();
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date1 - date2;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      let title = "";

      for (const age of getAging) {
        if (age.type === "first" && Number(age.firstValue) >= differenceInDays) {
          title = age.title;
          break;
        } else if (
          age.type === "last" &&
          Number(age.secondValue) <= differenceInDays
        ) {
          title = age.title;
          break;
        } else if (
          age.type === "some" &&
          Number(age.firstValue) <= differenceInDays &&
          Number(age.secondValue) >= differenceInDays
        ) {
          title = age.title;
          break;
        }
      }
      return title;
    };

    const filteredData = getData.map(doc => {
      const ROZNICA_FK_AS = doc.NALEZNOSC_FK - doc.NALEZNOSC_AS != 0 ? doc.NALEZNOSC_FK - doc.NALEZNOSC_AS : "NULL";
      const DATA_FV = doc.DATA_FV ? doc.DATA_FV : changeDate(doc.TERMIN_FV);
      // const BRAK_DATY_WYSTAWIENIA_FV = doc.DATA_FV ? null : "TAK";
      const ILE_DNI_NA_PLATNOSC_FV = howManyDays(DATA_FV, doc.TERMIN_FV);
      const PRZETER_NIEPRZETER = isOlderThanToday(doc.TERMIN_FV) ? "Przeterminowane" : "Nieprzeterminowane";
      const CZY_SAMOCHOD_WYDANY = doc.DATA_WYDANIA_AUTA && (doc.area === "SAMOCHODY NOWE" || doc.area === "SAMOCHODY UŻYWANE") ? "TAK" : null;
      const PRZEDZIAL_WIEKOWANIE = checkAging(doc.TERMIN_FV);
      const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA ? doc.FIRMA_ZEWNETRZNA : doc.JAKA_KANCELARIA_TU ? doc.JAKA_KANCELARIA_TU : null;
      const CZY_W_KANCELARI = JAKA_KANCELARIA ? "TAK" : "NIE";
      let KWOTA_WPS = CZY_W_KANCELARI === "TAK" ? doc.NALEZNOSC_AS : null;
      KWOTA_WPS = doc.area === "BLACHARNIA" && doc.JAKA_KANCELARIA_TU ? doc.KWOTA_WINDYKOWANA_BECARED : null;


      return {
        BRAK_DATY_WYSTAWIENIA_FV: doc.DATA_FV ? null : "TAK",
        CZY_SAMOCHOD_WYDANY_AS: CZY_SAMOCHOD_WYDANY,
        CZY_W_KANCELARI,
        DATA_ROZLICZENIA_AS: doc.DATA_ROZL_AS,
        DATA_WYDANIA_AUTA: doc.DATA_WYDANIA_AUTA,
        DATA_WYSTAWIENIA_FV: DATA_FV,
        DO_ROZLICZENIA_AS: doc.NALEZNOSC_AS,
        DZIAL: doc.DZIAL,
        ETAP_SPRAWY: doc.STATUS_AKTUALNY,
        ILE_DNI_NA_PLATNOSC_FV,
        JAKA_KANCELARIA,
        KONTRAHENT: doc.KONTRAHENT,
        KWOTA_DO_ROZLICZENIA_FK: doc.NALEZNOSC_FK,
        KWOTA_WPS,
        LOKALIZACJA: doc.localization,
        NR_DOKUMENTU: doc.NUMER_FV,
        NR_KLIENTA: doc.NR_KONTRAHENTA,
        OBSZAR: doc.area,
        OPIEKUN_OBSZARU_CENTRALI: doc.guardian,
        OPIS_ROZRACHUNKU: doc.OPIS_ROZRACHUNKU,
        OWNER: doc.owner,
        PRZEDZIAL_WIEKOWANIE,
        PRZETER_NIEPRZETER,
        RODZAJ_KONTA: doc.KONTO,
        ROZNICA: ROZNICA_FK_AS,
        TERMIN_PLATNOSCI_FV: doc.TERMIN_FV,
        TYP_DOKUMENTU: doc.TYP_DOKUMENTU,

      };
    });

    await connect_SQL.query("TRUNCATE TABLE fk_raport");


    // Teraz przygotuj dane do wstawienia
    const values = filteredData.map(item => [
      item.BRAK_DATY_WYSTAWIENIA_FV ?? null,
      item.CZY_SAMOCHOD_WYDANY_AS ?? null,
      item.CZY_W_KANCELARI ?? null,
      item.DATA_ROZLICZENIA_AS ?? null,
      item.DATA_WYDANIA_AUTA ?? null,
      item.DATA_WYSTAWIENIA_FV ?? null,
      item.DO_ROZLICZENIA_AS ?? null,
      item.DZIAL ?? null,
      item.ETAP_SPRAWY ?? null,
      item.ILE_DNI_NA_PLATNOSC_FV ?? null,
      item.JAKA_KANCELARIA ?? null,
      item.KONTRAHENT ?? null,
      item.KWOTA_DO_ROZLICZENIA_FK ?? null,
      item.KWOTA_WPS ?? null,
      item.LOKALIZACJA ?? null,
      item.NR_DOKUMENTU ?? null,
      item.NR_KLIENTA ?? null,
      item.OBSZAR ?? null,
      JSON.stringify(item.OPIEKUN_OBSZARU_CENTRALI) ?? null,
      JSON.stringify(item.OPIS_ROZRACHUNKU) ?? null,
      JSON.stringify(item.OWNER) ?? null,
      item.PRZEDZIAL_WIEKOWANIE ?? null,
      item.PRZETER_NIEPRZETER ?? null,
      item.RODZAJ_KONTA ?? null,
      item.ROZNICA ?? null,
      item.TERMIN_PLATNOSCI_FV ?? null,
      item.TYP_DOKUMENTU ?? null,
    ]);



    const query = `
       INSERT IGNORE INTO fk_raport
         (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DZIAL, ETAP_SPRAWY, ILE_DNI_NA_PLATNOSC_FV, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, NR_KLIENTA, OBSZAR, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OWNER, PRZEDZIAL_WIEKOWANIE, PRZETER_NIEPRZETER, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU) 
       VALUES 
         ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
     `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    const [checkRaportDate] = await connect_SQL.query(`SELECT title FROM fk_updates_date WHERE title='raport'`);

    if (checkRaportDate[0]?.title) {
      await connect_SQL.query(`UPDATE fk_updates_date SET  date = ?, counter = ? WHERE title = ?`,
        [checkDate(new Date()), getData.length || 0, 'raport']
      );
    } else {
      const sql = `INSERT INTO fk_updates_date (title, date, counter) VALUES (?, ?, ?)`;
      const params = ["raport", checkDate(new Date()), filteredData.length || 0];
      await connect_SQL.query(sql, params);
    }

    // res.json(filteredData);
    res.end();
  }
  catch (error) {
    logEvents(
      `fkRaportController, generateRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }

};

// generowanie raportu w wersji poprawionej 
const generateRaportV2 = async (req, res) => {
  try {
    const [getData] = await connect_SQL.query(`SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, 
RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, D.VIN,
DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, DA.INFORMACJA_ZARZAD, DA.HISTORIA_ZMIANY_DATY_ROZLICZENIA, DA.OSTATECZNA_DATA_ROZLICZENIA, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, 
S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS 
FROM raportFK_accountancy AS RA 
LEFT JOIN join_items AS JI ON RA.DZIAL = JI.department 
LEFT JOIN documents AS D ON RA.NUMER_FV = D.NUMER_FV 
LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id 
LEFT JOIN rubicon_raport_fk AS R ON RA.NUMER_FV = R.NUMER_FV 
LEFT JOIN settlements AS S ON RA.NUMER_FV = S.NUMER_FV 
LEFT JOIN settlements_description AS SD ON RA.NUMER_FV = SD.NUMER
`);
    // WHERE TYP_DOKUMENTU IN ('Faktura', 'Nota')`);
    // WHERE TYP_DOKUMENTU IN ('Faktura', 'Nota') AND R.FIRMA_ZEWNETRZNA IS NULL AND DA.JAKA_KANCELARIA_TU IS NULL`);


    // const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM aging_items');
    const [getAging] = await connect_SQL.query('SELECT \`FROM_TIME\`, TO_TIME, TITLE, TYPE FROM aging_items');

    console.log(getAging);

    // jeśli nie ma DATA_FV to od TERMIN_FV jest odejmowane 14 dni
    const changeDate = (dateStr) => {
      const date = new Date(dateStr);
      // Odejmij 14 dni
      date.setDate(date.getDate() - 14);
      // Przekonwertuj datę na format 'YYYY-MM-DD'
      const updatedDate = date.toISOString().split('T')[0];
      return updatedDate;
    };

    // odejmuje TERMIN_FV od DATA_FV
    const howManyDays = (DATA_FV, TERMIN_FV) => {
      // Konwersja dat w formacie yyyy-mm-dd na obiekty Date
      const date1 = new Date(DATA_FV);
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date2 - date1;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      return differenceInDays;
    };

    // sprawdza czy fv jest przeterminowana czy nieprzeterminowana
    const isOlderThanToday = (TERMIN_FV) => {
      // Konwersja TERMIN_FV na obiekt Date
      const terminDate = new Date(TERMIN_FV);
      // Pobranie dzisiejszej daty bez czasu (tylko yyyy-mm-dd)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerowanie godziny, minuty, sekundy, milisekundy
      return terminDate < today;
    };

    // przypisywanie przedziału wiekowania

    const checkAging = (TERMIN_FV) => {
      const date1 = new Date();
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date1 - date2;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      let title = "";

      for (const age of getAging) {
        if (age.TYPE === "first" && Number(age.FROM_TIME) >= differenceInDays) {
          title = age.TITLE;
          break;
        } else if (
          age.TYPE === "last" &&
          Number(age.TO_TIME) <= differenceInDays
        ) {
          title = age.TITLE;
          break;
        } else if (
          age.TYPE === "some" &&
          Number(age.FROM_TIME) <= differenceInDays &&
          Number(age.TO_TIME) >= differenceInDays
        ) {
          title = age.TITLE;
          break;
        }
      }
      return title;
    };
    const cleanData = getData.map(doc => {
      const ROZNICA_FK_AS = doc.NALEZNOSC_FK - doc.NALEZNOSC_AS != 0 ? doc.NALEZNOSC_FK - doc.NALEZNOSC_AS : "NULL";
      const DATA_FV = doc.DATA_FV ? doc.DATA_FV : changeDate(doc.TERMIN_FV);
      // const BRAK_DATY_WYSTAWIENIA_FV = doc.DATA_FV ? null : "TAK";
      const ILE_DNI_NA_PLATNOSC_FV = howManyDays(DATA_FV, doc.TERMIN_FV);
      const PRZETER_NIEPRZETER = isOlderThanToday(doc.TERMIN_FV) ? "Przeterminowane" : "Nieprzeterminowane";
      const CZY_SAMOCHOD_WYDANY = doc.DATA_WYDANIA_AUTA && (doc.area === "SAMOCHODY NOWE" || doc.area === "SAMOCHODY UŻYWANE") ? "TAK" : null;
      const PRZEDZIAL_WIEKOWANIE = checkAging(doc.TERMIN_FV);
      const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA ? doc.FIRMA_ZEWNETRZNA : doc.JAKA_KANCELARIA_TU && doc.area === 'BLACHARNIA' ? doc.JAKA_KANCELARIA_TU : null;
      const CZY_W_KANCELARI = JAKA_KANCELARIA ? "TAK" : "NIE";
      const HISTORIA_ZMIANY_DATY_ROZLICZENIA = doc?.HISTORIA_ZMIANY_DATY_ROZLICZENIA?.length ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length : null;
      let KWOTA_WPS = CZY_W_KANCELARI === "TAK" ? doc.NALEZNOSC_AS : null;
      KWOTA_WPS = doc.area === "BLACHARNIA" && doc.JAKA_KANCELARIA_TU ? doc.KWOTA_WINDYKOWANA_BECARED : null;


      return {
        BRAK_DATY_WYSTAWIENIA_FV: doc.DATA_FV ? null : "TAK",
        CZY_SAMOCHOD_WYDANY_AS: CZY_SAMOCHOD_WYDANY,
        CZY_W_KANCELARI,
        DATA_ROZLICZENIA_AS: doc.DATA_ROZL_AS,
        DATA_WYDANIA_AUTA: doc.DATA_WYDANIA_AUTA,
        DATA_WYSTAWIENIA_FV: DATA_FV,
        DO_ROZLICZENIA_AS: doc.NALEZNOSC_AS,
        DZIAL: doc.DZIAL,
        ETAP_SPRAWY: doc.STATUS_AKTUALNY,
        HISTORIA_ZMIANY_DATY_ROZLICZENIA,
        ILE_DNI_NA_PLATNOSC_FV,
        INFORMACJA_ZARZAD: doc.INFORMACJA_ZARZAD,
        JAKA_KANCELARIA,
        KONTRAHENT: doc.KONTRAHENT,
        KWOTA_DO_ROZLICZENIA_FK: doc.NALEZNOSC_FK,
        KWOTA_WPS,
        LOKALIZACJA: doc.localization,
        NR_DOKUMENTU: doc.NUMER_FV,
        NR_KLIENTA: doc.NR_KONTRAHENTA,
        OBSZAR: doc.area,
        OPIEKUN_OBSZARU_CENTRALI: doc.guardian,
        OPIS_ROZRACHUNKU: doc.OPIS_ROZRACHUNKU,
        OSTATECZNA_DATA_ROZLICZENIA: doc.OSTATECZNA_DATA_ROZLICZENIA,
        OWNER: doc.owner,
        PRZEDZIAL_WIEKOWANIE,
        PRZETER_NIEPRZETER,
        RODZAJ_KONTA: doc.KONTO,
        ROZNICA: ROZNICA_FK_AS,
        TERMIN_PLATNOSCI_FV: doc.TERMIN_FV,
        TYP_DOKUMENTU: doc.TYP_DOKUMENTU,
        VIN: doc.VIN
      };
    });


    // const filteredData = cleanData.filter(item => item.PRZEDZIAL_WIEKOWANIE !== "1-7" && item.PRZEDZIAL_WIEKOWANIE !== "<0");

    await connect_SQL.query("TRUNCATE TABLE fk_raport_v2");

    // Teraz przygotuj dane do wstawienia
    const values = cleanData.map(item => [
      item.BRAK_DATY_WYSTAWIENIA_FV ?? null,
      item.CZY_SAMOCHOD_WYDANY_AS ?? null,
      item.CZY_W_KANCELARI ?? null,
      item.DATA_ROZLICZENIA_AS ?? null,
      item.DATA_WYDANIA_AUTA ?? null,
      item.DATA_WYSTAWIENIA_FV ?? null,
      item.DO_ROZLICZENIA_AS ?? null,
      item.DZIAL ?? null,
      item.ETAP_SPRAWY ?? null,
      item.HISTORIA_ZMIANY_DATY_ROZLICZENIA ?? null,
      item.ILE_DNI_NA_PLATNOSC_FV ?? null,
      JSON.stringify(item.INFORMACJA_ZARZAD) ?? null,
      item.JAKA_KANCELARIA ?? null,
      item.KONTRAHENT ?? null,
      item.KWOTA_DO_ROZLICZENIA_FK ?? null,
      item.KWOTA_WPS ?? null,
      item.LOKALIZACJA ?? null,
      item.NR_DOKUMENTU ?? null,
      item.NR_KLIENTA ?? null,
      item.OBSZAR ?? null,
      item.OSTATECZNA_DATA_ROZLICZENIA ?? null,
      JSON.stringify(item.OPIEKUN_OBSZARU_CENTRALI) ?? null,
      JSON.stringify(item.OPIS_ROZRACHUNKU) ?? null,
      JSON.stringify(item.OWNER) ?? null,
      item.PRZEDZIAL_WIEKOWANIE ?? null,
      item.PRZETER_NIEPRZETER ?? null,
      item.RODZAJ_KONTA ?? null,
      item.ROZNICA ?? null,
      item.TERMIN_PLATNOSCI_FV ?? null,
      item.TYP_DOKUMENTU ?? null,
      item.VIN ?? null,
    ]);

    const query = `
INSERT IGNORE INTO fk_raport_v2
  (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DZIAL, ETAP_SPRAWY, HISTORIA_ZMIANY_DATY_ROZLICZENIA, ILE_DNI_NA_PLATNOSC_FV, INFORMACJA_ZARZAD, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, NR_KLIENTA, OBSZAR, OSTATECZNA_DATA_ROZLICZENIA, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OWNER, PRZEDZIAL_WIEKOWANIE, PRZETER_NIEPRZETER, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU, VIN) 
VALUES 
  ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
`;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    // dodanie daty wygenerowania raportu
    const [checkRaportDate] = await connect_SQL.query(`SELECT title FROM fk_updates_date WHERE title='raport_v2'`);

    if (checkRaportDate[0]?.title) {
      await connect_SQL.query(`UPDATE fk_updates_date SET  date = ?, counter = ? WHERE title = ?`,
        [checkDate(new Date()), getData.length || 0, 'raport_v2']
      );
    } else {
      const sql = `INSERT INTO fk_updates_date (title, date, counter) VALUES (?, ?, ?)`;
      const params = ["raport_v2", checkDate(new Date()), cleanData.length || 0];
      await connect_SQL.query(sql, params);
    }

    res.end();
  }
  catch (error) {
    console.error(error);
    logEvents(
      `fkRaportController, generateRaportV2: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });

  }
};

//funkcja dodaje dane z pliku wiekowania i sprawdza czy w pliku wiekowanie znajdują się dokumentu do których jest przygotowany dział (lokalizacja, owner itp) jeśli nie ma zwraca ionformacje o brakach
const dataFkAccocuntancyFromExcel = async (req, res) => {
  const { documents_data } = req.body;
  try {
    const [preparedItems] = await connect_SQL.query(
      "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
    );
    // dodaje wygenerowane na działy na podstawie nazwy documentu
    const resultDep = prepareDepartments(documents_data);

    if (!resultDep) {
      return res.status(500).json({ error: "Server error" });
    }

    const addItems = generateItems(preparedItems, resultDep);

    if (!addItems) {
      return res.status(500).json({ error: "Server error" });
    } else if (addItems.errorDepartments.length) {
      return res.json({ errorDepartments: addItems.errorDepartments });
    }

    const addDocDate = await docDateUpdate(addItems.generateData);
    if (!addDocDate) {
      return res.status(500).json({ error: "Server error" });
    }

    const updateSettlements = await updateSettlementDescription(addDocDate);
    if (!updateSettlements) {
      return res.status(500).json({ error: "Server error" });
    }

    await savePreparedData(updateSettlements, 'accountancy');

    res.end();
  }
  catch (error) {
    logEvents(
      `fkRaportController, dataFkAccocuntancyFromExcel: ${error}`,
      "reqServerErrors.txt"
    );
    return res.status(500).json({ error: "Server error" });
  }
};

// funkcja która robi znaczniki przy dokumentach,m zgodnych z dokumentami z fkraport, żeby user mógł mieć dostęp tylko do dokumentów omawianych w fkraport
const saveMark = async (req, res) => {
  const documents = req.body;
  try {
    // // await connect_SQL.query(`UPDATE mark_documents SET RAPORT_FK = 0`);
    await connect_SQL.query('TRUNCATE mark_documents');


    // // Teraz przygotuj dane do wstawienia
    const values = documents.map(item => [
      item
    ]);

    const query = `
       INSERT IGNORE INTO mark_documents
         (NUMER_FV, RAPORT_FK) 
       VALUES 
         ${values.map(() => "(?, 1)").join(", ")}
     `;

    // // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        'Dokumenty Raportu FK'
      ]);
    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, saveMark: ${error}`, "reqServerErrors.txt");
    connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Błąd aktualizacji",
        'Dokumenty Raportu FK'
      ]);
  }
};

// usunięcie danego dokumentu z wyświetlania w tabeli dla danego działu
const changeMark = async (req, res) => {
  const { NUMER_FV, MARK_FK } = req.body;
  try {

    await connect_SQL.query(
      "UPDATE mark_documents SET RAPORT_FK = ? WHERE NUMER_FV = ?",
      [
        MARK_FK,
        NUMER_FV
      ]
    );
    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, changeMark: ${error}`, "reqServerErrors.txt");

  }
};


// pobiera dane do raportu kontroli dokuemntów BL
const getRaportDocumentsControlBL = async (req, res) => {
  try {
    const [dataReport] = await connect_SQL.query(
      "SELECT CD.*, FKR.NR_DOKUMENTU, D.KONTRAHENT, D.NR_SZKODY, D.BRUTTO, D.DZIAL, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE,  datediff(D.TERMIN, D.DATA_FV) AS ILE_DNI_NA_PLATNOSC FROM fk_raport_v2 AS FKR LEFT JOIN documents AS D ON FKR.NR_DOKUMENTU = D.NUMER_FV LEFT JOIN settlements as S ON FKR.NR_DOKUMENTU = S.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN control_documents AS CD ON FKR.NR_DOKUMENTU = CD.NUMER_FV WHERE FKR.OBSZAR ='BLACHARNIA' AND FKR.CZY_W_KANCELARI = 'NIE' AND FKR.PRZEDZIAL_WIEKOWANIE !='<0' AND FKR.PRZEDZIAL_WIEKOWANIE !='1-7' AND FKR.DO_ROZLICZENIA_AS > 0"
    );
    if (dataReport.length) {
      const cleanedData = dataReport.map(({ id_control_documents, NUMER_FV, ...rest }) => rest);
      res.json(cleanedData);
    } else {
      res.json([]);
    }

  }
  catch (error) {
    logEvents(`fkRaportController, getRaportDocumentsControlBL: ${error}`, "reqServerErrors.txt");
    ;
  }
};

// pobiera dane struktury orgaznizacji
const getStructureOrganization = async (req, res) => {
  try {
    const [data] = await connect_SQL.query(
      "SELECT * FROM join_items ORDER BY department"
    );

    const findMail = await Promise.all(
      data.map(async (item) => {
        const ownerMail = await Promise.all(
          item.owner.map(async (own) => {
            const [mail] = await connect_SQL.query(
              `SELECT owner_mail FROM owner_items WHERE owner = ?`, [own]
            );

            // Zamiana null na "Brak danych"
            return mail.map(row => row.owner_mail || "Brak danych");
          })
        );

        return {
          ...item,
          mail: ownerMail.flat() // Spłaszczamy tablicę wyników
        };
      })
    );


    if (data.length) {
      const cleanedData = findMail.map(({ id_join_items, ...rest }) => rest);
      res.json(cleanedData);
    } else {
      res.json([]);
    }
  }
  catch (error) {
    logEvents(`fkRaportController, getStructureOrganization: ${error}`, "reqServerErrors.txt");
    ;
  }
};

const generateHistoryDocuments = async (req, res) => {
  try {
    const [dataFK] = await connect_SQL.query(
      "SELECT MD.NUMER_FV, DA.OSTATECZNA_DATA_ROZLICZENIA, DA.HISTORIA_ZMIANY_DATY_ROZLICZENIA, DA.INFORMACJA_ZARZAD FROM mark_documents as MD LEFT JOIN documents AS D ON MD.NUMER_FV = D.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id WHERE MD.RAPORT_FK = 1");

    const [accounancyDate] = await connect_SQL.query(`SELECT date FROM fk_updates_date WHERE title = 'accountancy'`);

    if (!accounancyDate[0]?.date) {
      return res.end();
    }
    const raportDate = accounancyDate[0].date;

    for (const doc of dataFK) {


      const [searchDoc] = await connect_SQL.query(`SELECT * FROM history_fk_documents WHERE NUMER_FV = ?`, [doc.NUMER_FV]);

      if (searchDoc.length) {
        const COUNTER_DATE = searchDoc[0].COUNTER_DATE;

        // jeśli raport jest wygenerowany tego samego dnia, a były już wpisy, to je aktualizaujemy
        if (COUNTER_DATE.includes(raportDate)) {

          const historyDoc = searchDoc[0].HISTORY_DOC.map(item => {
            if (item.date === raportDate) {
              //aktualizuję historię daty rozliczenia
              let historyDate = Array.isArray(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA : [];
              const historyDateItem = Array.isArray(searchDoc[0].HISTORY_DOC[0].history.historyDate) ? searchDoc[0].HISTORY_DOC[0].history.historyDate : [];
              // Znalezienie ostatniego wspólnego indeksu
              const lastDateIndex = historyDate
                .map((el, index) => historyDateItem.includes(el) ? index : -1)
                .filter(index => index !== -1)
                .pop(); // Pobieramy ostatni indeks

              if (lastDateIndex !== undefined && lastDateIndex + 1 < historyDate.length) {
                historyDate = historyDate.slice(lastDateIndex + 1);
              } else {
                historyDate = []; // Jeśli tablice są identyczne, ustawiamy pustą tablicę
              }

              // Dodanie tylko jeśli historyText nie jest puste
              const updateHistoryDate = historyDate.length > 0
                ? [...historyDateItem, ...historyDate]
                : historyDateItem;

              // aktualizauję historię decyzji biznesu
              let historyText = Array.isArray(doc.INFORMACJA_ZARZAD) ? doc.INFORMACJA_ZARZAD : [];
              const historyTextItem = Array.isArray(searchDoc[0].HISTORY_DOC[0].history.historyText) ? searchDoc[0].HISTORY_DOC[0].history.historyText : [];

              // Znalezienie ostatniego wspólnego indeksu
              const lastTextIndex = historyText
                .map((el, index) => historyTextItem.includes(el) ? index : -1)
                .filter(index => index !== -1)
                .pop(); // Pobieramy ostatni indeks
              if (lastTextIndex !== undefined && lastTextIndex + 1 < historyText.length) {
                historyText = historyText.slice(lastTextIndex + 1);
              } else {
                historyText = []; // Jeśli tablice są identyczne, ustawiamy pustą tablicę
              }

              // Dodanie tylko jeśli historyText nie jest puste
              const updateHistoryText = historyText.length > 0
                ? [...historyTextItem, ...historyText]
                : historyTextItem;

              return {
                ...item,
                history: {
                  ...item.history,
                  historyDate: updateHistoryDate,
                  historyText: updateHistoryText
                },
                historyCounter: {
                  date: updateHistoryDate?.length ? updateHistoryDate.length : 0,
                  text: updateHistoryText?.length ? updateHistoryText.length : 0
                }
              };
            }
            return item;
          });

          await connect_SQL.query(`UPDATE history_fk_documents SET HISTORY_DOC = ? WHERE NUMER_FV = ?`, [
            JSON.stringify(historyDoc),
            searchDoc[0].NUMER_FV
          ]);

        } else {

          const counterDate = [...searchDoc[0].COUNTER_DATE, raportDate];
          const info = `${searchDoc[0].HISTORY_DOC.length + 1} raport utworzono ${raportDate}`;

          //aktualizuję historię daty rozliczenia
          let historyDate = Array.isArray(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA : [];
          const historyDateItem = Array.isArray(searchDoc[0].HISTORY_DOC) ? searchDoc[0].HISTORY_DOC[searchDoc[0].HISTORY_DOC.length - 1].history.historyDate : [];

          // Znalezienie ostatniego wspólnego indeksu
          const lastDateIndex = historyDate
            .map((el, index) => historyDateItem.includes(el) ? index : -1)
            .filter(index => index !== -1)
            .pop(); // Pobieramy ostatni indeks

          if (lastDateIndex !== undefined && lastDateIndex + 1 < historyDate.length) {
            historyDate = historyDate.slice(lastDateIndex + 1);
          } else {
            historyDate = []; // Jeśli tablice są identyczne, ustawiamy pustą tablicę
          }

          // aktualizauję historię decyzji biznesu
          let historyText = Array.isArray(doc.INFORMACJA_ZARZAD) ? doc.INFORMACJA_ZARZAD : [];
          const historyTextItem = Array.isArray(searchDoc[0].HISTORY_DOC) ? searchDoc[0].HISTORY_DOC[searchDoc[0].HISTORY_DOC.length - 1].history.historyText : [];

          // Znalezienie ostatniego wspólnego indeksu
          const lastTextIndex = historyText
            .map((el, index) => historyTextItem.includes(el) ? index : -1)
            .filter(index => index !== -1)
            .pop(); // Pobieramy ostatni indeks
          if (lastTextIndex !== undefined && lastTextIndex + 1 < historyText.length) {
            historyText = historyText.slice(lastTextIndex + 1);
          } else {
            historyText = []; // Jeśli tablice są identyczne, ustawiamy pustą tablicę
          }

          const historyDoc = {
            date: raportDate,
            history: {
              info,
              historyDate,
              historyText
            },
            historyCounter: {
              date: historyDate?.length ? historyDate.length : 0,
              text: historyText?.length ? historyText.length : 0
            }
          };


          const updateDoc = [...searchDoc[0].HISTORY_DOC, historyDoc];

          await connect_SQL.query(`UPDATE history_fk_documents SET COUNTER_DATE = ?, HISTORY_DOC = ? WHERE NUMER_FV = ?`, [
            JSON.stringify(counterDate),
            JSON.stringify(updateDoc),
            searchDoc[0].NUMER_FV
          ]);
        }
      } else {
        const history = [{
          date: raportDate,
          historyCounter: {
            date: doc?.HISTORIA_ZMIANY_DATY_ROZLICZENIA?.length ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length : 0,
            text: doc?.INFORMACJA_ZARZAD?.length ? doc.INFORMACJA_ZARZAD.length : 0
          },
          history: {
            info: `1 raport utworzono ${raportDate}`,
            historyDate: doc?.HISTORIA_ZMIANY_DATY_ROZLICZENIA ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA : [],
            historyText: doc?.INFORMACJA_ZARZAD ? doc.INFORMACJA_ZARZAD : []
          }
        }];


        await connect_SQL.query(`INSERT INTO history_fk_documents (NUMER_FV, COUNTER_DATE, HISTORY_DOC) VALUES (?, ?, ?)`, [
          doc.NUMER_FV,
          JSON.stringify([raportDate]),
          JSON.stringify(history)
        ]);
      }
    }
    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, generateHistoryDocuments: ${error}`, "reqServerErrors.txt");

    console.error(error);
  }
};

module.exports = {
  getRaportData,
  getRaportDataV2,
  getDateCounter,
  deleteDataRaport,
  generateRaport,
  generateRaportV2,
  dataFkAccocuntancyFromExcel,
  saveMark,
  changeMark,
  getRaportDocumentsControlBL,
  getStructureOrganization,
  generateHistoryDocuments
};
