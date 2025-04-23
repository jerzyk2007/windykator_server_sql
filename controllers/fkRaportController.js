const { connect_SQL } = require("../config/dbConn");
const { checkDate, checkTime } = require('./manageDocumentAddition');
const { documentsType } = require('./manageDocumentAddition');
const { getExcelRaport } = require('./fkRaportExcelGenerate');

const { logEvents } = require("../middleware/logEvents");

// do wyszukiwania różnic pomiędzy FK a AS
const differencesAS_FK = async (company) => {
  try {
    //pobieram wszytskie numery faktur z programu
    const [docAS] = await connect_SQL.query(`
      SELECT D.NUMER_FV FROM company_documents AS D 
      LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY WHERE S.NALEZNOSC !=0 AND D.FIRMA = ?`, [company]);

    const fvAS = docAS.map(item => item.NUMER_FV);

    const [docFK] = await connect_SQL.query(`SELECT NR_DOKUMENTU FROM company_fk_raport_${company}`);
    const fvFK = docFK.map(item => item.NR_DOKUMENTU);

    const filteredFvAS = fvAS.filter(fv => !fvFK.includes(fv));

    const sqlCondition = filteredFvAS?.length > 0 ? `(${filteredFvAS.map(dep => `D.NUMER_FV = '${dep}'`).join(' OR ')})` : null;

    const [getDoc] = await connect_SQL.query(
      `SELECT D.NUMER_FV AS NR_DOKUMENTU, D.DZIAL, IFNULL(JI.localization, 'BRAK DANYCH') AS LOKALIZACJA, D.KONTRAHENT, S.NALEZNOSC AS DO_ROZLICZENIA_AS, 
      D.DATA_FV AS DATA_WYSTAWIENIA_FV, D.TERMIN AS TERMIN_PLATNOSCI_FV,
      IFNULL(JI.AREA, 'BRAK DANYCH') AS OBSZAR, IFNULL(JI.GUARDIAN, 'BRAK DANYCH') AS OPIEKUN_OBSZARU_CENTRALI, 
      IFNULL(JI.OWNER,  'BRAK DANYCH') AS OWNER
      FROM company_documents AS D 
      LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
      LEFT JOIN company_join_items AS JI ON D.DZIAL = JI.department
      WHERE S.NALEZNOSC !=0 AND ${sqlCondition} AND D.FIRMA = ?`, [company]
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
const getRaportData = async (req, res) => {
  const { company } = req.params;
  const { raportInfo } = req.body;

  try {

    const [dataRaport] = await connect_SQL.query(
      `SELECT HFD.HISTORY_DOC AS HISTORIA_WPISOW, FK.* 
      FROM company_fk_raport_${company} AS FK 
      LEFT JOIN company_history_KRT AS HFD ON FK.NR_DOKUMENTU = HFD.NUMER_FV AND FK.FIRMA = HFD.COMPANY`);


    // usuwam z każdego obiektu klucz id_fk_raport
    dataRaport.forEach(item => {
      delete item.id_fk_raport;
    });
    const getDifferencesFK_AS = await differencesAS_FK(company);

    await connect_SQL.query(`UPDATE company_fk_updates_date SET  DATE = ?, COUNTER = ? WHERE TITLE = ? AND COMPANY = ?`,
      [checkDate(new Date()), 0, 'raport', company]
    );

    const accountArray = [
      ...new Set(
        dataRaport
          .filter((item) => item.RODZAJ_KONTA)
          .map((item) => item.OBSZAR)
      ),
    ].sort();


    //zamieniam daty w stringu na typ Date, jeżeli zapis jest odpowiedni 
    const convertToDateIfPossible = (value) => {
      // Sprawdź, czy wartość jest stringiem w formacie yyyy-mm-dd
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (typeof value === 'string' && datePattern.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      // Jeśli nie spełnia warunku lub nie jest datą, zwróć oryginalną wartość
      return "NULL";
    };

    // // usuwam wartości null, bo excel ma z tym problem
    const eraseNull = dataRaport.map(item => {

      const historyDoc = (value) => {
        const raportCounter = `Dokument pojawił się w raporcie ${value.length} raz.`;

        const infoFK = value.map(item => {

          return [
            " ",
            item.info,
            "Daty rozliczenia: ",
            ...(Array.isArray(item.historyDate) && item.historyDate.length
              ? item.historyDate
              : ["brak daty rozliczenia"]),
            "Decyzja: ",
            ...(Array.isArray(item.historyText) && item.historyText.length
              ? item.historyText
              : ["brak decyzji biznesu"]),

          ];
        });

        const mergedInfoFK = infoFK.flat();

        mergedInfoFK.unshift(raportCounter);
        return mergedInfoFK.join("\n");
      };
      return {
        ...item,
        ILE_DNI_NA_PLATNOSC_FV: item.ILE_DNI_NA_PLATNOSC_FV,
        RODZAJ_KONTA: item.RODZAJ_KONTA,
        NR_KLIENTA: item.NR_KLIENTA,
        DO_ROZLICZENIA_AS: item.DO_ROZLICZENIA_AS ? item.DO_ROZLICZENIA_AS : "NULL",
        DORADCA_FV: item.DORADCA ? item.DORADCA : "Brak danych",
        ROZNICA: item.ROZNICA !== 0 ? item.ROZNICA : "NULL",
        DATA_ROZLICZENIA_AS: item.DATA_ROZLICZENIA_AS ? convertToDateIfPossible(
          item.DATA_ROZLICZENIA_AS) : "NULL",
        BRAK_DATY_WYSTAWIENIA_FV: item.BRAK_DATY_WYSTAWIENIA_FV ? item.BRAK_DATY_WYSTAWIENIA_FV : " ",
        JAKA_KANCELARIA: item.JAKA_KANCELARIA ? item.JAKA_KANCELARIA : " ",
        ETAP_SPRAWY: item.ETAP_SPRAWY ? item.ETAP_SPRAWY : " ",
        KWOTA_WPS: item.KWOTA_WPS ? item.KWOTA_WPS : " ",
        CZY_SAMOCHOD_WYDANY_AS: item.CZY_SAMOCHOD_WYDANY_AS ? item.CZY_SAMOCHOD_WYDANY_AS : " ",
        DATA_WYDANIA_AUTA: item.DATA_WYDANIA_AUTA ? convertToDateIfPossible(item.DATA_WYDANIA_AUTA) : " ",
        OPIEKUN_OBSZARU_CENTRALI: Array.isArray(item.OPIEKUN_OBSZARU_CENTRALI)
          ? item.OPIEKUN_OBSZARU_CENTRALI.join("\n")
          : item.OPIEKUN_OBSZARU_CENTRALI,
        OPIS_ROZRACHUNKU: Array.isArray(item.OPIS_ROZRACHUNKU)
          ? item.OPIS_ROZRACHUNKU.join("\n\n")
          : "NULL",
        OWNER: Array.isArray(item.OWNER) ? item.OWNER.join("\n") : item.OWNER,
        DATA_WYSTAWIENIA_FV: convertToDateIfPossible(
          item.DATA_WYSTAWIENIA_FV
        ),
        TERMIN_PLATNOSCI_FV: convertToDateIfPossible(
          item.TERMIN_PLATNOSCI_FV
        ),
        INFORMACJA_ZARZAD: Array.isArray(item.INFORMACJA_ZARZAD)
          // ? item.INFORMACJA_ZARZAD.join("\n\n")
          ? item.INFORMACJA_ZARZAD[item.INFORMACJA_ZARZAD.length - 1]
          : " ",
        HISTORIA_ZMIANY_DATY_ROZLICZENIA: item?.HISTORIA_ZMIANY_DATY_ROZLICZENIA > 0 ? item.HISTORIA_ZMIANY_DATY_ROZLICZENIA : " ",
        OSTATECZNA_DATA_ROZLICZENIA: item.OSTATECZNA_DATA_ROZLICZENIA ? convertToDateIfPossible(item.OSTATECZNA_DATA_ROZLICZENIA) : " ",
        VIN: item?.VIN ? item.VIN : ' ',
        HISTORIA_WPISÓW_W_RAPORCIE: item?.HISTORIA_WPISOW ? historyDoc(item.HISTORIA_WPISOW) : null
      };
    }
    );



    const cleanDifferences = getDifferencesFK_AS.map(item => {
      return {
        ...item,
        OWNER: Array.isArray(item.OWNER) ? item.OWNER.join("\n") : item.OWNER,
        OPIEKUN_OBSZARU_CENTRALI: Array.isArray(item.OPIEKUN_OBSZARU_CENTRALI)
          ? item.OPIEKUN_OBSZARU_CENTRALI.join("\n")
          : item.OPIEKUN_OBSZARU_CENTRALI,
        TERMIN_PLATNOSCI_FV: convertToDateIfPossible(
          item.TERMIN_PLATNOSCI_FV
        ),
        DATA_WYSTAWIENIA_FV: convertToDateIfPossible(
          item.DATA_WYSTAWIENIA_FV
        ),
        DO_ROZLICZENIA_AS: Number(item.DO_ROZLICZENIA_AS),
        KONTROLA_DOC: item.NR_DOKUMENTU &&
          !["PO", "NO"].includes(item.NR_DOKUMENTU.slice(0, 2)) && item.DO_ROZLICZENIA_AS > 0
          ? "TAK"
          : "NIE"
      };
    });

    // // rozdziela dane na poszczególne obszary BLACHARNIA, CZĘŚCI itd
    const resultArray = accountArray.reduce((acc, area) => {
      // Filtrujemy obiekty, które mają odpowiedni OBSZAR
      const filteredData = eraseNull.filter(item => item.OBSZAR === area);

      // Jeśli są dane, dodajemy obiekt do wynikowej tablicy
      if (filteredData.length > 0) {
        // acc.push({ [area]: filteredData });
        acc.push({ name: area, data: filteredData });
      }

      return acc;
    }, []);

    // /// tworzę osobny element tablicy dla arkusza WYDANE/NIEZAPŁACONE z warunkami, jest data wydania i nie jest rozliczone w AS
    const carDataSettlement = eraseNull.map(item => {
      if ((item.OBSZAR === "SAMOCHODY NOWE" || item.OBSZAR === "SAMOCHODY UŻYWANE") && item.DO_ROZLICZENIA_AS > 0 && item.CZY_SAMOCHOD_WYDANY_AS === "TAK") {
        return item;
      }

    }).filter(Boolean);

    // // Dodajemy obiekt RAPORT na początku tablicy i  dodtkowy arkusz z róznicami księgowosć AS-FK
    const finalResult = [{ name: 'ALL', data: eraseNull }, { name: 'KSIĘGOWOŚĆ AS', data: cleanDifferences }, { name: 'WYDANE - NIEZAPŁACONE', data: carDataSettlement }, ...resultArray];

    // usuwam wiekowanie starsze niż < 0, 1 - 7 z innych niż arkusza RAPORT
    const updateAging = finalResult.map((element) => {
      if (element.name !== "ALL" && element.name !== "KSIĘGOWOŚĆ" && element.name !== 'KSIĘGOWOŚĆ AS' && element.data) {
        const updatedData = element.data.filter((item) => {
          return item.PRZEDZIAL_WIEKOWANIE !== "1 - 7" && item.PRZEDZIAL_WIEKOWANIE !== "< 0" && item.DO_ROZLICZENIA_AS > 0
            &&
            (item.TYP_DOKUMENTU === 'Faktura'
              || item.TYP_DOKUMENTU === 'Faktura zaliczkowa'
              || item.TYP_DOKUMENTU === 'Korekta'
              || item.TYP_DOKUMENTU === 'Nota');
        });
        return { ...element, data: updatedData }; // Zwracamy zaktualizowany element
      } else {
        const updatedData = element.data.map((item) => {
          const { HISTORIA_WPISÓW_W_RAPORCIE, ...rest } = item;
          return rest; // Zwróć obiekt bez tych dwóch kluczy
        });
        return { ...element, data: updatedData };
      }
    });

    //usuwam kolumny CZY_SAMOCHOD_WYDANY_AS, DATA_WYDANIA_AUTA z innych arkuszy niż Raport, SAMOCHODY NOWE, SAMOCHODY UŻYWANE
    const updateCar = updateAging.map((element) => {
      if (
        element.name !== "ALL" &&
        element.name !== "SAMOCHODY NOWE" &&
        element.name !== "SAMOCHODY UŻYWANE" &&
        element.name !== "WYDANE - NIEZAPŁACONE"
      ) {
        const updatedData = element.data.map((item) => {
          const { CZY_SAMOCHOD_WYDANY_AS, DATA_WYDANIA_AUTA, ...rest } = item;
          return rest; // Zwróć obiekt bez tych dwóch kluczy
        });
        return { ...element, data: updatedData };
      }
      return element;
    });

    const updateVIN = updateCar.map((element) => {
      if (
        element.name === "BLACHARNIA" ||
        element.name === "CZĘŚCI"
      ) {
        const updatedData = element.data.map((item) => {
          const { VIN, ...rest } = item;
          return rest; // Zwróć obiekt bez tych dwóch kluczy
        });
        return { ...element, data: updatedData };
      }
      return element;
    });

    // usuwam kolumnę BRAK DATY WYSTAWIENIA FV ze wszytskich arkuszy oprócz RAPORT
    const updateFvDate = updateVIN.map((element) => {
      if (element.name !== "ALL" && element.name !== 'KSIĘGOWOŚĆ AS') {

        const filteredData = element.data.filter(item => item.CZY_W_KANCELARI === 'NIE');

        const updatedData = filteredData.map((item) => {
          const { BRAK_DATY_WYSTAWIENIA_FV, ROZNICA, JAKA_KANCELARIA, CZY_W_KANCELARI, KWOTA_WPS, ETAP_SPRAWY, DATA_ROZLICZENIA_AS, OPIS_ROZRACHUNKU, ILE_DNI_NA_PLATNOSC_FV, RODZAJ_KONTA, NR_KLIENTA, ...rest } = item;
          return rest;
        });
        return { ...element, data: updatedData };
      }
      return element;
    });

    // usuwam kolumnę KONTROLA ze wszytskich arkuszy oprócz KSIĘGOWOŚĆ AS
    const updateControlColumn = updateFvDate.map((element) => {
      if (element.name !== 'KSIĘGOWOŚĆ AS') {
        const updatedData = element.data.map((item) => {
          const { KONTROLA, ...rest } = item;
          return rest;
        });
        return { ...element, data: updatedData };
      }
      return element;
    });

    // usuwam kolumnę DORADCA ze wszytskich arkuszy oprócz BLACHARNIA
    const updateAdvisersColumn = updateFvDate.map((element) => {
      if (element.name !== 'BLACHARNIA') {
        const updatedData = element.data.map((item) => {
          const { DORADCA_FV, ...rest } = item;
          return rest;
        });
        return { ...element, data: updatedData };
      }
      return element;
    });

    // obrabiam tylko dane działu KSIĘGOWOŚĆ
    const accountingData = updateAdvisersColumn.map(item => {
      if (item.name === 'KSIĘGOWOŚĆ') {
        // pierwsze filtrowanie wszytskich danych
        const dataDoc = eraseNull.filter(doc =>
          doc.TYP_DOKUMENTU !== 'PK' &&
          doc.TYP_DOKUMENTU !== 'Inne' &&
          doc.TYP_DOKUMENTU !== 'Korekta' &&
          doc.ROZNICA !== "NULL" &&
          doc.DATA_ROZLICZENIA_AS !== "NULL" &&
          doc.DATA_ROZLICZENIA_AS <= new Date(raportInfo.accountingDate)
        );

        // drugie filtrowanie wszytskich danych
        const dataDoc2 = eraseNull.filter(doc =>
          doc.TYP_DOKUMENTU === 'Korekta' &&
          doc.DO_ROZLICZENIA_AS !== "NULL" &&
          doc.ROZNICA !== "NULL"
        );
        const joinData = [...dataDoc, ...dataDoc2];
        const updateDataDoc = joinData.map(prev => {
          const { INFORMACJA_ZARZAD, OSTATECZNA_DATA_ROZLICZENIA, HISTORIA_ZMIANY_DATY_ROZLICZENIA, HISTORIA_WPISÓW_W_RAPORCIE, ...rest } = prev;
          return rest;
        });
        return {
          name: item.name,
          data: updateDataDoc
        };
      }
      return item;
    });

    //wyciągam tylko nr documentów do tablicy, żeby postawić znacznik przy danej fakturze, żeby mozna było pobrać do tabeli wyfiltrowane dane z tabeli
    const excludedNames = ['ALL', 'KSIĘGOWOŚĆ', 'WYDANE - NIEZAPŁACONE', 'KSIĘGOWOŚĆ AS'];

    const markDocuments = updateControlColumn
      .filter(doc => !excludedNames.includes(doc.name)) // Filtruj obiekty o nazwach do wykluczenia
      .flatMap(doc => doc.data) // Rozbij tablice data na jedną tablicę
      .map(item => item.NR_DOKUMENTU); // Wyciągnij klucz NR_DOKUMENTU      



    // console.log(markDocuments.sort());
    // console.log(markDocuments.length);

    saveMark(markDocuments, company);
    // res.json({ dataRaport, differences: getDifferencesFK_AS });

    //sortowanie obiektów wg kolejności, żeby arkusze w excel były odpowiednio posortowane
    const sortOrder = ["ALL", "WYDANE - NIEZAPŁACONE", "BLACHARNIA", "CZĘŚCI", "F&I", "KSIĘGOWOŚĆ", "KSIĘGOWOŚĆ AS", "SAMOCHODY NOWE", "SAMOCHODY UŻYWANE", "SERWIS", "WDT",];

    const sortedArray = accountingData.sort((a, b) =>
      sortOrder.indexOf(a.name) - sortOrder.indexOf(b.name)
    );

    const excelBuffer = await getExcelRaport(sortedArray, raportInfo);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=raport.xlsx');
    res.send(excelBuffer);

  } catch (error) {
    logEvents(`fkRaportController, getRaportData: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// pobieram daty  aktualizacji plików excel dla raportu FK !!!
const getDateCounter = async (req, res) => {
  const { company } = req.params;
  try {
    const [result] = await connect_SQL.query(`SELECT TITLE, DATE, COUNTER FROM company_fk_updates_date WHERE COMPANY = ?`, [company]);
    const updateData = result.reduce((acc, item) => {
      acc[item.TITLE] = {
        date: item.DATE,    // Przypisanie `date` jako `hour`
        counter: item.COUNTER,
      };
      return acc;
    }, {});
    const [getUpdatesData] = await connect_SQL.query(
      "SELECT DATA_NAME, DATE, HOUR, UPDATE_SUCCESS FROM company_updates WHERE DATA_NAME = 'Rozrachunki'"
    );

    const dms = {
      date: getUpdatesData[0]?.UPDATE_SUCCESS === 'Zaktualizowano.' ? getUpdatesData[0].DATE : "Błąd aktualizacji",
      hour: getUpdatesData[0]?.UPDATE_SUCCESS === 'Zaktualizowano.' ? getUpdatesData[0].HOUR : "Błąd aktualizacji",
    };

    // await connect_SQL.query(`UPDATE company_fk_updates_date SET  DATE = ?, COUNTER = ? WHERE TITLE = ? AND COMPANY = ?`,
    //   [checkDate(new Date()), 0, 'raport', company]
    // );

    updateData.dms = dms;

    res.json({ updateData });
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
  const { company } = req.params;
  try {
    // await generateHistoryDocuments(company);
    await connect_SQL.query(
      `UPDATE company_fk_updates_date SET DATE = null, COUNTER = null WHERE TITLE IN ('accountancy', 'generate', 'raport') AND COMPANY = ?`,
      [company]
    );
    await connect_SQL.query('DELETE FROM company_mark_documents WHERE COMPANY = ?', [company]);
    await connect_SQL.query(`TRUNCATE company_raportFK_${company}_accountancy`);
    await connect_SQL.query(`TRUNCATE TABLE company_fk_raport_${company}`);


    res.json({ result: "delete" });
  } catch (error) {
    logEvents(
      `fkRaportController, deleteDataRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// generowanie raportu w wersji poprawionej 
const generateRaport = async (req, res) => {
  const { company } = req.params;
  try {
    const [getData] = await connect_SQL.query(`
          SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, 
          RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, 
    RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.LOCALIZATION, JI.AREA, 
    JI.OWNER, JI.GUARDIAN, D.DATA_FV, D.VIN, D.DORADCA, 
    DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, 
    DA.INFORMACJA_ZARZAD, DA.HISTORIA_ZMIANY_DATY_ROZLICZENIA, 
    DA.OSTATECZNA_DATA_ROZLICZENIA, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, 
    S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS 
    FROM company_raportFK_${company}_accountancy AS RA 
    LEFT JOIN company_join_items AS JI ON RA.DZIAL = JI.department AND RA.FIRMA = JI.COMPANY
    LEFT JOIN company_documents AS D ON RA.NUMER_FV = D.NUMER_FV AND RA.FIRMA = D.FIRMA
    LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id 
    LEFT JOIN company_rubicon_raport_fk AS R ON RA.NUMER_FV = R.NUMER_FV AND RA.FIRMA = R.COMPANY
    LEFT JOIN company_settlements AS S ON RA.NUMER_FV = S.NUMER_FV AND RA.FIRMA = S.COMPANY
    LEFT JOIN company_settlements_description AS SD ON RA.NUMER_FV = SD.NUMER AND RA.FIRMA = SD.COMPANY
    `);

    const test = getData.map(item => {
      if (item.NUMER_FV === 'FV/UBL/90/25/V/D8') {
        console.log(item);
      }
    });

    // const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM company_aging_items');
    const [getAging] = await connect_SQL.query('SELECT \`FROM_TIME\`, TO_TIME, TITLE, TYPE FROM company_aging_items');

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

      //   // Oblicz różnicę w czasie (w milisekundach)
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

    const normalizeDate = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0); // Ustawienie godziny na 00:00:00
      return d;
    };

    // przypisywanie przedziału wiekowania
    const checkAging = (TERMIN_FV) => {

      const date1 = normalizeDate(new Date());
      const date2 = normalizeDate(new Date(TERMIN_FV));

      // Oblicz różnicę w dniach
      const differenceInDays = Math.round((date1 - date2) / (1000 * 60 * 60 * 24));

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
        DORADCA: doc.DORADCA,
        DZIAL: doc.DZIAL,
        ETAP_SPRAWY: doc.STATUS_AKTUALNY,
        HISTORIA_ZMIANY_DATY_ROZLICZENIA,
        ILE_DNI_NA_PLATNOSC_FV,
        INFORMACJA_ZARZAD: doc.INFORMACJA_ZARZAD,
        JAKA_KANCELARIA,
        KONTRAHENT: doc.KONTRAHENT,
        KWOTA_DO_ROZLICZENIA_FK: doc.NALEZNOSC_FK,
        KWOTA_WPS,
        LOKALIZACJA: doc.LOCALIZATION,
        NR_DOKUMENTU: doc.NUMER_FV,
        NR_KLIENTA: doc.NR_KONTRAHENTA,
        OBSZAR: doc.AREA,
        OPIEKUN_OBSZARU_CENTRALI: doc.GUARDIAN,
        OPIS_ROZRACHUNKU: doc.OPIS_ROZRACHUNKU,
        OSTATECZNA_DATA_ROZLICZENIA: doc.OSTATECZNA_DATA_ROZLICZENIA,
        OWNER: doc.OWNER,
        PRZEDZIAL_WIEKOWANIE,
        PRZETER_NIEPRZETER,
        RODZAJ_KONTA: doc.KONTO,
        ROZNICA: ROZNICA_FK_AS,
        TERMIN_PLATNOSCI_FV: doc.TERMIN_FV,
        TYP_DOKUMENTU: doc.TYP_DOKUMENTU,
        VIN: doc.VIN,
        FIRMA: company
      };
    });
    await connect_SQL.query(`TRUNCATE TABLE company_fk_raport_${company}`);

    // Teraz przygotuj dane do wstawienia
    const values = cleanData.map(item => [
      item.BRAK_DATY_WYSTAWIENIA_FV ?? null,
      item.CZY_SAMOCHOD_WYDANY_AS ?? null,
      item.CZY_W_KANCELARI ?? null,
      item.DATA_ROZLICZENIA_AS ?? null,
      item.DATA_WYDANIA_AUTA ?? null,
      item.DATA_WYSTAWIENIA_FV ?? null,
      item.DO_ROZLICZENIA_AS ?? null,
      item.DORADCA ?? null,
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
      item.FIRMA
    ]);

    const query = `
        INSERT IGNORE INTO company_fk_raport_${company}
          (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DORADCA, DZIAL, ETAP_SPRAWY, HISTORIA_ZMIANY_DATY_ROZLICZENIA, ILE_DNI_NA_PLATNOSC_FV, INFORMACJA_ZARZAD, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, NR_KLIENTA, OBSZAR, OSTATECZNA_DATA_ROZLICZENIA, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OWNER, PRZEDZIAL_WIEKOWANIE, PRZETER_NIEPRZETER, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU, VIN, FIRMA) 
        VALUES 
          ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
        `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    // // dodanie daty wygenerowania raportu
    // const [checkRaportDate] = await connect_SQL.query(`SELECT title FROM fk_updates_date WHERE title='raport_v2'`);

    await connect_SQL.query(`UPDATE company_fk_updates_date SET  DATE = ?, COUNTER = ? WHERE TITLE = ? AND COMPANY = ?`,
      [checkDate(new Date()), getData.length || 0, 'generate', company]
    );

    // await connect_SQL.query(
    //   `UPDATE company_fk_updates_date SET DATE = null, COUNTER = null WHERE TITLE = 'raport' AND COMPANY = ?`,
    //   [company]
    // );

    res.end();
  }
  catch (error) {
    console.error(error);
    logEvents(
      `fkRaportController, generateRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });

  }
};

//funkcja dodaje dane z pliku wiekowania i sprawdza czy w pliku wiekowanie znajdują się dokumentu do których jest przygotowany dział (lokalizacja, owner itp) jeśli nie ma zwraca ionformacje o brakach
// const dataFkAccocuntancyFromExcel = async (req, res) => {
//   const { documents_data } = req.body;
//   try {
//     const [preparedItems] = await connect_SQL.query(
//       "SELECT DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN FROM company_join_items ORDER BY DEPARTMENT"
//     );
//     // dodaje wygenerowane na działy na podstawie nazwy documentu
//     const resultDep = prepareDepartments(documents_data);

//     if (!resultDep) {
//       return res.status(500).json({ error: "Server error" });
//     }

//     const addItems = generateItems(preparedItems, resultDep);

//     if (!addItems) {
//       return res.status(500).json({ error: "Server error" });
//     } else if (addItems.errorDepartments.length) {
//       return res.json({ errorDepartments: addItems.errorDepartments });
//     }

//     const addDocDate = await docDateUpdate(addItems.generateData);
//     if (!addDocDate) {
//       return res.status(500).json({ error: "Server error" });
//     }

//     const updateSettlements = await updateSettlementDescription(addDocDate);
//     if (!updateSettlements) {
//       return res.status(500).json({ error: "Server error" });
//     }

//     await savePreparedData(updateSettlements, 'accountancy');

//     res.end();
//   }
//   catch (error) {
//     logEvents(
//       `fkRaportController, dataFkAccocuntancyFromExcel: ${error}`,
//       "reqServerErrors.txt"
//     );
//     return res.status(500).json({ error: "Server error" });
//   }
// };

// funkcja która robi znaczniki przy dokumentach,m zgodnych z dokumentami z fkraport, żeby user mógł mieć dostęp tylko do dokumentów omawianych w fkraport
const saveMark = async (documents, company) => {
  // const documents = req.body;
  try {

    const [markDocs] = await connect_SQL.query(`SELECT NUMER_FV, COMPANY, RAPORT_FK FROM company_mark_documents WHERE COMPANY != ?`, [company]);


    const prepareMarks = documents.map(doc => {
      return {
        NUMER_FV: doc,
        COMPANY: company,
        RAPORT_FK: 1
      };
    });

    const newMarks = [
      ...prepareMarks,
      ...(markDocs.length ? markDocs : [])
    ];

    await connect_SQL.query('TRUNCATE company_mark_documents');

    // Teraz przygotuj dane do wstawienia
    const values = newMarks.map(item => [
      item.NUMER_FV,
      item.COMPANY,
      item.RAPORT_FK
    ]);

    const query = `
       INSERT IGNORE INTO company_mark_documents
         (NUMER_FV, COMPANY, RAPORT_FK) 
       VALUES 
         ${values.map(() => "(?, ?, ?)").join(", ")}
     `;

    // // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());


    // // await connect_SQL.query(`UPDATE mark_documents SET RAPORT_FK = 0`);
    // await connect_SQL.query('TRUNCATE company_mark_documents');

    // await connect_SQL.query('DELETE FROM company_mark_documents WHERE COMPANY = ?', [company]);

    // // Teraz przygotuj dane do wstawienia
    // const values = documents.map(item => [
    //   item
    // ]);

    // const query = `
    //    INSERT IGNORE INTO company_mark_documentssss
    //      (NUMER_FV, RAPORT_FK) 
    //    VALUES 
    //      ${values.map(() => "(?, 1)").join(", ")}
    //  `;

    // // // Wykonanie zapytania INSERT
    // await connect_SQL.query(query, values.flat());

    connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        `Dokumenty Raportu FK - ${company}`
      ]);
  }
  catch (error) {
    logEvents(`fkRaportController, saveMark: ${error}`, "reqServerErrors.txt");
    connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
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
  const { NUMER_FV, MARK_FK, FIRMA } = req.body;
  try {
    await connect_SQL.query(
      "UPDATE company_mark_documents SET RAPORT_FK = ? WHERE NUMER_FV = ? AND COMPANY = ?",
      [
        MARK_FK,
        NUMER_FV,
        FIRMA
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
      "SELECT CD.*, D.NUMER_FV,  D.KONTRAHENT, D.NR_SZKODY, D.BRUTTO, D.DZIAL, D.DORADCA, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, datediff(D.TERMIN, D.DATA_FV) AS ILE_DNI_NA_PLATNOSC FROM company_documents AS D LEFT JOIN company_settlements as S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN company_control_documents AS CD ON D.NUMER_FV = CD.NUMER_FV LEFT JOIN company_join_items AS JI ON D.DZIAL = JI.department LEFT JOIN rubicon AS R ON R.NUMER_FV = D.NUMER_FV WHERE JI.area = 'BLACHARNIA' AND S.NALEZNOSC > 0 AND DA.JAKA_KANCELARIA_TU IS NULL AND R.FIRMA_ZEWNETRZNA IS NULL AND D.TERMIN < DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
    );
    if (dataReport.length) {
      const cleanedData = dataReport.map(({ id_control_documents, ...rest }) => rest);
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
      "SELECT * FROM company_join_items ORDER BY department"
    );

    const findMail = await Promise.all(
      data.map(async (item) => {
        const ownerMail = await Promise.all(
          item.OWNER.map(async (own) => {
            const [mail] = await connect_SQL.query(
              `SELECT OWNER_MAIL FROM company_owner_items WHERE owner = ?`, [own]
            );

            // Zamiana null na "Brak danych"
            return mail.map(row => row.OWNER_MAIL || "Brak danych");
          })
        );

        return {
          ...item,
          MAIL: ownerMail.flat() // Spłaszczamy tablicę wyników
        };
      })
    );

    const [accounts] = await connect_SQL.query(
      "SELECT username, usersurname, userlogin, departments FROM company_users"
    );
    const filteredDeps = accounts.map(item => {
      return {
        ...item,
        departments: item.departments.map(acc => `${acc.department}-${acc.company}`)
      };
    });

    if (data.length && accounts.length) {
      const structure = findMail.map(({ id_join_items, ...rest }) => rest);

      return res.json({ structure, accounts: filteredDeps });
    } else {
      return res.json({ structure: [], accounts: [] });
    }
  }
  catch (error) {
    logEvents(`fkRaportController, getStructureOrganization: ${error}`, "reqServerErrors.txt");
    ;
  }
};

const generateHistoryDocuments = async (company) => {
  try {

    const [raportDate] = await connect_SQL.query(`SELECT DATE FROM  company_fk_updates_date WHERE title = 'accountancy'`);

    const testDate = '2025-04-10';

    const [markDocuments] = await connect_SQL.query(`SELECT NUMER_FV FROM company_mark_documents WHERE RAPORT_FK = 1 AND COMPANY = ?`, [company]);
    // console.log(raportDate[0].DATE);

    // ******
    // const [oldHistory] = await connect_SQL.query(`SELECT * FROM windykacja.history_fk_documents;`);

    // console.log(oldHistory);
    // const updateHistory = oldHistory.map(item => {
    //   return {
    //     ...item,
    //     COMPANY: company
    //   };
    // });

    // for (const item of updateHistory) {
    //   await connect_SQL.query(`INSERT INTO company_windykacja.company_history_KRT (NUMER_FV, HISTORY_DOC, COMPANY) VALUES (?, ?, ?)`,
    //     [item.NUMER_FV, JSON.stringify(item.HISTORY_DOC), item.COMPANY]);
    // }
    // *******

    // for (const item of markDocuments) {
    //   const [getDoc] = await connect_SQL.query(`SELECT * FROM company_management_date_description_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ? AND COMPANY = ?`, [item.NUMER_FV, testDate, company]);

    //   const [getDocHist] = await connect_SQL.query(`SELECT HISTORY_DOC FROM company_history_KRT WHERE NUMER_FV = ? AND COMPANY = ?`, [item.NUMER_FV, company]);
    //   if (!getDocHist.length) {
    //     const newHistory = {
    //       info: `1 raport utworzono ${raportDate[0].date}`,
    //       historyDate: [],
    //       historyText: []
    //     };

    //     // console.log(getDoc);
    //     // Przechodzimy przez każdy obiekt w getDoc i dodajemy wartości do odpowiednich tablic
    //     getDoc.forEach(doc => {
    //       console.log(doc);
    //       if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
    //         newHistory.historyDate.push(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
    //       }
    //       if (doc.INFORMACJA_ZARZAD) {
    //         newHistory.historyText.push(doc.INFORMACJA_ZARZAD);
    //       }
    //     });

    //     await connect_SQL.query(`INSERT INTO history_fk_documents (NUMER_FV, HISTORY_DOC) VALUES (?, ?)`,
    //       [item.NUMER_FV, JSON.stringify([newHistory])]);
    //   }

    // }

    // mapuje wszytskie dokumenty oznaczone znacznikiem wsytępowania i dodaję do nich opisy, daty
    // const addDesc = markDocuments.map(async (item) => {



    // for (const item of markDocuments) {
    //   // sprawdzam czy dokument ma wpisy histori w tabeli management_decision_FK
    //   // const [getDoc] = await connect_SQL.query(`SELECT * FROM management_decision_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ?`, [item.NUMER_FV, raportDate[0].DATE]);
    //   const [getDoc] = await connect_SQL.query(`SELECT * FROM company_management_date_description_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ? AND COMPANY = ?`, [item.NUMER_FV, testDate, company]);

    //   //szukam czy jest wpis histori w tabeli history_fk_documents
    //   const [getDocHist] = await connect_SQL.query(`SELECT HISTORY_DOC FROM company_history_KRT WHERE NUMER_FV = ? AND COMPANY`, [item.NUMER_FV, company]);


    //   if (!getDocHist.length) {

    //     const newHistory = {
    //       info: `1 raport utworzono ${testDate}`,
    //       // info: `1 raport utworzono ${raportDate[0].date}`,
    //       historyDate: [],
    //       historyText: []
    //     };

    //     // Przechodzimy przez każdy obiekt w getDoc i dodajemy wartości do odpowiednich tablic
    //     getDoc.forEach(doc => {
    //       if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
    //         newHistory.historyDate.push(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
    //       }
    //       if (doc.INFORMACJA_ZARZAD) {
    //         newHistory.historyText.push(doc.INFORMACJA_ZARZAD);
    //       }
    //     });
    //     // console.log(newHistory);

    //     await connect_SQL.query(`INSERT INTO company_history_KRT (NUMER_FV, HISTORY_DOC, COMPANY) VALUES (?, ?, ?)`,
    //       [item.NUMER_FV, JSON.stringify([newHistory]), company]);
    //   } else {

    //     const newHistory = {
    //       info: `${getDocHist[0].HISTORY_DOC.length + 1} raport utworzono ${testDate}`,
    //       // info: `${getDocHist[0].HISTORY_DOC.length + 1} raport utworzono ${raportDate[0].DATE}`,
    //       historyDate: [],
    //       historyText: []
    //     };
    //     getDoc.forEach(doc => {
    //       if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
    //         newHistory.historyDate.push(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
    //       }
    //       if (doc.INFORMACJA_ZARZAD) {
    //         newHistory.historyText.push(doc.INFORMACJA_ZARZAD);
    //       }
    //     });
    //     const prepareArray = [...getDocHist[0].HISTORY_DOC, newHistory];
    //     // if (item.NUMER_FV === 'FV/UBL/165/22/S/D148') {
    //     //   console.log(prepareArray);

    //     // }
    //     await connect_SQL.query(`UPDATE  company_history_KRT SET HISTORY_DOC = ? WHERE NUMER_FV = ? AND COMPANY = ?`,
    //       [JSON.stringify(prepareArray), item.NUMER_FV], company);
    //   }
    // }
    // });

  }
  catch (error) {
    logEvents(`fkRaportController, generateHistoryDocuments: ${error}`, "reqServerErrors.txt");

  }
};

const addDecisionDate = async (req, res) => {
  const { NUMER_FV, FIRMA, data } = req.body;
  try {
    const [raportDate] = await connect_SQL.query(`SELECT DATE FROM company_fk_updates_date WHERE TITLE = 'accountancy'`);
    if (!raportDate[0].DATE) {
      return res.end();
    }

    // if (data.INFORMACJA_ZARZAD.length && raportDate[0].DATE) {
    //   for (item of data.INFORMACJA_ZARZAD) {
    //     await connect_SQL.query(`INSERT INTO management_decision_FK (NUMER_FV, INFORMACJA_ZARZAD, WYKORZYSTANO_RAPORT_FK) VALUES (?, ?, ?)`, [
    //       NUMER_FV,
    //       item,
    //       raportDate[0].DATE
    //     ]);
    //   }
    // }
    // if (data.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length && raportDate[0].DATE) {

    //   for (item of data.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {

    //     await connect_SQL.query(`INSERT INTO management_decision_FK (NUMER_FV, HISTORIA_ZMIANY_DATY_ROZLICZENIA, WYKORZYSTANO_RAPORT_FK) VALUES (?, ?, ?)`, [
    //       NUMER_FV,
    //       item,
    //       raportDate[0].DATE
    //     ]);
    //   }
    // }

    // robię zapis równoległy do nowej tabelimanagement_date_description_FK
    const [searchDuplicate] = await connect_SQL.query(
      `SELECT * FROM  company_management_date_description_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ? AND COMPANY = ?`,
      [NUMER_FV, raportDate[0].DATE, FIRMA]);
    if (searchDuplicate[0]?.id_management_date_description_FK) {
      const id = searchDuplicate[0].id_management_date_description_FK;
      // const NUMER_FV = searchDuplicate[0].NUMER_FV;
      const HISTORIA_ZMIANY_DATY_ROZLICZENIA = searchDuplicate[0].HISTORIA_ZMIANY_DATY_ROZLICZENIA;
      const INFORMACJA_ZARZAD = searchDuplicate[0].INFORMACJA_ZARZAD;
      // const WYKORZYSTANO_RAPORT_FK = searchDuplicate[0].WYKORZYSTANO_RAPORT_FK;

      if (Array.isArray(data.INFORMACJA_ZARZAD) && data.INFORMACJA_ZARZAD.length) {
        INFORMACJA_ZARZAD.push(...data.INFORMACJA_ZARZAD);
      }

      if (Array.isArray(data.HISTORIA_ZMIANY_DATY_ROZLICZENIA) && data.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length) {
        HISTORIA_ZMIANY_DATY_ROZLICZENIA.push(...data.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
      }

      await connect_SQL.query(`UPDATE management_date_description_FK SET INFORMACJA_ZARZAD = ?, HISTORIA_ZMIANY_DATY_ROZLICZENIA = ? WHERE id_management_date_description_FK = ?  `,
        [JSON.stringify(INFORMACJA_ZARZAD), JSON.stringify(HISTORIA_ZMIANY_DATY_ROZLICZENIA), id]
      );
    } else {

      await connect_SQL.query(`INSERT INTO company_management_date_description_FK (NUMER_FV, INFORMACJA_ZARZAD, HISTORIA_ZMIANY_DATY_ROZLICZENIA, WYKORZYSTANO_RAPORT_FK, COMPANY) VALUES (?, ?, ?, ?, ?)`,
        [NUMER_FV, JSON.stringify(data.INFORMACJA_ZARZAD), JSON.stringify(data.HISTORIA_ZMIANY_DATY_ROZLICZENIA), raportDate[0].DATE, FIRMA]
      );
    }
    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, addDecision: ${error}`, "reqServerErrors.txt");

  }
};

module.exports = {
  getRaportData,
  getDateCounter,
  deleteDataRaport,
  generateRaport,
  // saveMark,
  changeMark,
  getRaportDocumentsControlBL,
  getStructureOrganization,
  generateHistoryDocuments,
  addDecisionDate
};
