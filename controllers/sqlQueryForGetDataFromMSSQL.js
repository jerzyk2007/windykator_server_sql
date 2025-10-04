const companyDbMap = {
  KRT: "AS3_KROTOSKI_PRACA",
  KEM: "AS3_PRACA_KROTOSKI_ELECTROMOBILITY",
  RAC: "AS3_PRACA_KROTOSKI_RENT_A_CAR",
  // dodaj więcej w razie potrzeby
};

// zapytanie do MSSQL dla wyszukania dokumnetów płatniczych dla firm: KRT, KEM, RAC i może w przyszłości kolejnych, zmienna type
const addDocumentToDatabaseQuery = (company, twoDaysAgo) => {
  if (company !== "RAC") {
    const dbCompany = companyDbMap[company];

    return `SELECT 
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
FROM [${dbCompany}].[dbo].[FAKTDOC] AS fv
LEFT JOIN [${dbCompany}].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
LEFT JOIN [${dbCompany}].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
LEFT JOIN [${dbCompany}].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
LEFT JOIN [${dbCompany}].[dbo].[AUTO] AS auto ON fv.AUTO_ID = auto.AUTO_ID
LEFT JOIN [${dbCompany}].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
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
  } else {
    return `    
    SELECT  
    [faktn_fakt_nr_caly] AS NUMER,
    SUM([faktp_og_brutto]) AS WARTOSC_BRUTTO,
    SUM([faktp_og_netto]) AS WARTOSC_NETTO,
    SUM([faktn_zaplata_kwota]) AS WARTOSC_NAL,
    CONVERT(VARCHAR(10), MIN([dataWystawienia]), 23) AS DATA_WYSTAWIENIA,
    CONVERT(VARCHAR(10), MIN([terminPlatnosci]), 23) AS DATA_ZAPLATA,
    MAX([kl_nazwa]) AS KONTR_NAZWA,
    MAX([faktn_wystawil]) AS PRZYGOTOWAL,
    NULL AS REJESTRACJA,
    NULL AS UWAGI,
    MAX([typSprzedazy]) AS TYP_PLATNOSCI,
    MAX([kl_nip]) AS KONTR_NIP,  
    'RAC' AS MARKER
FROM [RAPDB].[dbo].[RAC_zestawieniePrzychodow]
 WHERE [dataWystawienia]> '${twoDaysAgo}' AND [faktn_fakt_nr_caly] IS NOT NULL
GROUP BY [faktn_fakt_nr_caly];
    `;
  }
};
// zapytanie fv zaliczkowe, nazwy i kwoty
const updateDocZaLQuery = (company) => {
  const dbCompany = companyDbMap[company];

  return `SELECT 
    fv.[NUMER] AS NUMER_FV,
	    CASE 
        WHEN pos.[NAZWA] LIKE '%FV/ZAL%' THEN 
            SUBSTRING(
                pos.[NAZWA], 
                CHARINDEX('FV/ZAL', pos.[NAZWA]), 
                CHARINDEX('''', pos.[NAZWA] + '''', CHARINDEX('FV/ZAL', pos.[NAZWA])) - CHARINDEX('FV/ZAL', pos.[NAZWA])
            )
        ELSE NULL
    END AS FV_ZALICZKOWA,
	    SUM(CASE WHEN pos.[NAZWA] LIKE '%Faktura zaliczkowa%' THEN -pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO
 --   pos.[NAZWA]
FROM [${dbCompany}].[dbo].[FAKTDOC] AS fv
LEFT JOIN [${dbCompany}].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
WHERE fv.[NUMER] != 'POTEM' 
  AND pos.[NAZWA] LIKE '%FV/ZAL%'
GROUP BY 
    fv.[NUMER],
    pos.[NAZWA]`;
};

const updateCarReleaseDatesQuery = (company, twoDaysAgo) => {
  const dbCompany = companyDbMap[company];

  return `
  SELECT 
      [NUMER], 
      CONVERT(VARCHAR(10), [DATA_WYDANIA], 23) AS DATA_WYDANIA 
  FROM [${dbCompany}].[dbo].[FAKTDOC] 
  WHERE [DATA_WYDANIA] IS NOT NULL 
    AND [DATA_WYSTAWIENIA] > '${twoDaysAgo}' 
    AND [NUMER] != 'POTEM'
`;
};

const updateSettlementsQueryRac = () => {
  const today = new Date();
  const todayDate = today.toISOString().split("T")[0];
  const querySettlementsFK = `
DECLARE @datado DATETIME = '${todayDate}';
DECLARE @DataDoDate DATE = CAST(@datado AS DATE);
DECLARE @DataDoPlusJedenDzien DATE = DATEADD(day, 1, @DataDoDate);

WITH
-- Krok 1: Pre-agregacja rozrachunków. To jest najlepsza praktyka i pozostaje bez zmian.
cte_Rozrachunki AS (
    SELECT
        transakcja,
        SUM(kwota * SIGN(0.5 - strona)) AS WnMaRozliczono,
        SUM(CASE WHEN walutaObca IS NULL THEN kwota_w ELSE rozliczonoWO END * SIGN(0.5 - strona)) AS WnMaRozliczono_w
    FROM FK_Rent_SK.FK.rozrachunki
    WHERE dataokr < @DataDoPlusJedenDzien AND czyRozliczenie = 1 AND potencjalna = 0
    GROUP BY transakcja
),
-- Krok 2: Przygotowanie trzech podstawowych bloków danych z wstępną agregacją.
-- Blok A: Zobowiązania - część 1
cte_Zobowiazania_Blok_A AS (
    SELECT
        dsymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            (CASE WHEN orgstrona = 0 THEN SUM(rozdata.kwota) ELSE -SUM(rozdata.kwota) END) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 1 OR (rozdata.strona = 0 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND rozdata.strona = 1
    GROUP BY dsymbol, termin, orgstrona, synt, poz1, poz2, kpu.skrot, rozdata.kurs
),
-- Blok B: Zobowiązania - część 2
cte_Zobowiazania_Blok_B AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) -
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.baza = 2 AND rozdata.synt IN (201, 203)
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND rozdata.rozliczona = 0 AND rozdata.termin <= @DataDoDate
      AND rozdata.strona = 0 AND rozdata.kwota < 0 AND rozdata.doRozlZl > 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.skrot
),
-- Blok C: Należności
cte_Naleznosci_Blok_C AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND strona = 0 AND rozdata.orgStrona = 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.skrot
),
-- Krok 3: Połączenie wstępnie zagregowanych bloków z zachowaniem oryginalnej logiki UNION / UNION ALL
cte_Wszystkie_Transakcje AS (
    -- Tutaj odtwarzamy oryginalny UNION, który usuwa duplikaty między dwoma blokami zobowiązań
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_A
    UNION
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_B
    UNION ALL
    -- A następnie dodajemy należności
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Naleznosci_Blok_C
),
-- Krok 4: Końcowa, spłaszczona agregacja. To jest znacznie wydajniejsze niż wielopoziomowe grupowanie.
cte_Zagregowane AS (
    SELECT
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania,
        SUM(overdue) AS płatność
    FROM cte_Wszystkie_Transakcje
    GROUP BY
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania
),
-- Krok 5: Finałowe obliczenia (funkcje okna, przedziały) i filtrowanie zer
cte_WynikKoncowy AS (
    SELECT
        @DataDoDate AS stanNa,
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, płatność,
        CASE
            WHEN DniPrzetreminowania < 1   THEN '< 1'
            WHEN DniPrzetreminowania <= 30 THEN '1 - 30'
            WHEN DniPrzetreminowania <= 60 THEN '31 - 60'
            WHEN DniPrzetreminowania <= 90 THEN '61 - 90'
            WHEN DniPrzetreminowania <= 180 THEN '91 - 180'
            WHEN DniPrzetreminowania <= 360 THEN '181 - 360'
            ELSE '> 360'
        END AS przedział,
        -- Warunkowe obliczanie salda
        SUM(płatność) OVER (
            PARTITION BY synt, CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END
        ) AS saldoKontrahent
    FROM cte_Zagregowane
    WHERE ROUND(płatność, 2) <> 0
)
-- Końcowy SELECT
SELECT
    stanNa,
    dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, przedział, płatność,
    ROUND(saldoKontrahent, 2) AS saldoKontrahent,
    CASE
        WHEN ROUND(saldoKontrahent, 2) > 0 THEN 'N'
        WHEN ROUND(saldoKontrahent, 2) < 0 THEN 'Z'
        ELSE 'R'
    END AS Typ
FROM cte_WynikKoncowy
ORDER BY
    synt,
    CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END,
    termin;
    `;

  return querySettlementsFK;
};

const updateSettlementsQuery = (company) => {
  if (company !== "RAC") {
    const dbCompany = companyDbMap[company];

    return `
DECLARE @IS_BILANS BIT = 1;
DECLARE @IS_ROZLICZONY BIT = 0;
DECLARE @DATA_KONIEC DATETIME = GETDATE();

SELECT 
   T.OPIS,
 T.WARTOSC_SALDO,
CONVERT(VARCHAR(10),  T.DATA, 23) AS DATA_FV
FROM [${dbCompany}].[dbo].[TRANSDOC] T WITH(NOLOCK)
WHERE T.IS_BILANS = @IS_BILANS
 AND T.IS_ROZLICZONY = @IS_ROZLICZONY
 AND T.DATA <= @DATA_KONIEC
 AND T.WARTOSC_SALDO IS NOT NULL
 AND T.TERMIN IS NOT NULL
       `;
  } else {
    return updateSettlementsQueryRac();
  }
};

const updateSettlementDescriptionQuery = (company) => {
  const dbCompany = companyDbMap[company];

  return `SELECT 
     CASE 
          WHEN CHARINDEX(' ', tr.[OPIS]) > 0 THEN LEFT(tr.[OPIS], CHARINDEX(' ', tr.[OPIS]) - 1) 
          ELSE tr.[OPIS] 
      END AS NUMER_FV,
  rozl.[OPIS] AS NUMER_OPIS,
  CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA], 
  CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI, 
  rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI
  FROM     [${dbCompany}].[dbo].TRANSDOC AS tr 
  LEFT JOIN    [${dbCompany}].[dbo].[TRANSDOC] AS rozl   
  ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID] 
  WHERE rozl.[WARTOSC_SALDO] IS NOT NULL`;
};

const accountancyFKData = (company, endDate) => {
  const queryKRT = `
 DECLARE @datado DATETIME = '${endDate}';
DECLARE @DataDoDate DATE = CAST(@datado AS DATE);
DECLARE @DataDoPlusJedenDzien DATE = DATEADD(day, 1, @DataDoDate);

WITH
-- CTE 1: Pre-agregacja rozrachunków.
cte_Rozrachunki AS (
    SELECT
        transakcja,
        SUM(kwota * SIGN(0.5 - strona)) AS WnMaRozliczono,
        SUM(CASE WHEN walutaObca IS NULL THEN kwota_w ELSE rozliczonoWO END * SIGN(0.5 - strona)) AS WnMaRozliczono_w
    FROM [fkkomandytowa].[FK].[rozrachunki]
    WHERE dataokr < @DataDoPlusJedenDzien AND czyRozliczenie = 1 AND potencjalna = 0
    GROUP BY transakcja
),
-- CTE 2: Kompletna, zagnieżdżona agregacja dla ZOBOWIĄZAŃ.
cte_Zobowiazania_Aggr AS (
    SELECT
        t.dsymbol, t.kontrahent, t.synt, t.poz1, t.poz2, t.termin, t.dniPrzetreminowania,
        SUM(t.overdue) AS płatność
    FROM (
        -- Wewnętrzna podselekcja dla Zobowiązań z UNION
        SELECT
            dsymbol, CAST(termin AS DATE) AS termin,
            DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
            synt, poz1, poz2, kpu.nazwa AS kontrahent,
            ROUND(
                (CASE WHEN orgstrona = 0 THEN SUM(rozdata.kwota) ELSE -SUM(rozdata.kwota) END) +
                SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
            , 2) AS overdue
        FROM [fkkomandytowa].[FK].[fk_rozdata] AS rozdata
        LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
        LEFT JOIN [fkkomandytowa].[FK].[fk_kontrahenci] AS kpu ON rozdata.kontrahent = kpu.pozycja
        WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
          AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
          AND (rozdata.strona = 1 OR (rozdata.strona = 0 AND rozdata.kwota < 0))
          AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
          AND rozdata.strona = 1
        GROUP BY dsymbol, termin, orgstrona, synt, poz1, poz2, kpu.nazwa, rozdata.kurs
        
        UNION
        
        SELECT
            dSymbol, CAST(termin AS DATE) AS termin,
            DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
            synt, poz1, poz2, kpu.nazwa AS kontrahent,
            ROUND(
                SUM(rozdata.kwota) -
                SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
            , 2) AS overdue
        FROM [fkkomandytowa].[FK].[fk_rozdata] AS rozdata
        LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
        LEFT JOIN [fkkomandytowa].[FK].[fk_kontrahenci] AS kpu ON rozdata.kontrahent = kpu.pozycja
        WHERE rozdata.potencjalna = 0 AND rozdata.baza = 2
          AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
          AND rozdata.rozliczona = 0 AND rozdata.termin <= @DataDoDate
          AND rozdata.strona = 0 AND rozdata.kwota < 0 AND rozdata.doRozlZl > 0
          AND rozdata.synt IN (201, 203)
        GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.nazwa
    ) AS t
    GROUP BY t.dsymbol, t.kontrahent, t.synt, t.poz1, t.poz2, t.termin, t.dniPrzetreminowania
),
-- CTE 3: Kompletna agregacja dla NALEŻNOŚCI.
cte_Naleznosci_Aggr AS (
    SELECT
        t.dsymbol, t.kontrahent, t.synt, t.poz1, t.poz2, t.termin, t.dniPrzetreminowania,
        SUM(t.overdue) AS płatność
    FROM (
        -- Wewnętrzna podselekcja dla Należności
        SELECT
            dsymbol, CAST(termin AS DATE) AS termin,
            DATEDIFF(DAY, termin, @DataDoDate) AS DniPrzetreminowania,
            synt, poz1, poz2, kpu.nazwa AS kontrahent,
            ROUND(
                SUM(rozdata.kwota) +
                SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
            , 2) AS overdue
        FROM [fkkomandytowa].[FK].[fk_rozdata] AS rozdata
        LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
        LEFT JOIN [fkkomandytowa].[FK].[fk_kontrahenci] AS kpu ON rozdata.kontrahent = kpu.pozycja
        WHERE rozdata.potencjalna = 0 AND rozdata.dataokr < @DataDoPlusJedenDzien
          AND rozdata.synt IN (201, 203) AND rozdata.baza = 2
          AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
          AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
          AND strona = 0 AND rozdata.orgStrona = 0
        GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.nazwa
    ) AS t
    GROUP BY t.dsymbol, t.kontrahent, t.synt, t.poz1, t.poz2, t.termin, t.dniPrzetreminowania
),
-- CTE 4: Łączenie gotowych, zagregowanych wyników.
cte_Combined_Results AS (
    SELECT * FROM cte_Zobowiazania_Aggr
    UNION ALL
    SELECT * FROM cte_Naleznosci_Aggr
),
-- CTE 5: Finałowe obliczenia na połączonym zestawie.
cte_Final_Calculation AS (
    SELECT
        @DataDoDate AS stanNa,
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, płatność,
        CASE
            WHEN DniPrzetreminowania < 1   THEN '< 1'
            WHEN DniPrzetreminowania <= 30 THEN '1 - 30'
            WHEN DniPrzetreminowania <= 60 THEN '31 - 60'
            WHEN DniPrzetreminowania <= 90 THEN '61 - 90'
            WHEN DniPrzetreminowania <= 180 THEN '91 - 180'
            WHEN DniPrzetreminowania <= 360 THEN '181 - 360'
            ELSE '> 360'
        END AS przedział,
        SUM(płatność) OVER (
            PARTITION BY synt, CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END
        ) AS saldoKontrahent
    FROM cte_Combined_Results
    WHERE ROUND(płatność, 2) <> 0
)
-- Końcowy SELECT, który zwraca wynik do aplikacji.
SELECT
    stanNa,
    dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, przedział, płatność,
    ROUND(saldoKontrahent, 2) AS saldoKontrahent,
    CASE
        WHEN ROUND(saldoKontrahent, 2) > 0 THEN 'N'
        WHEN ROUND(saldoKontrahent, 2) < 0 THEN 'Z'
        ELSE 'R'
    END AS Typ
FROM cte_Final_Calculation
ORDER BY
    synt,
    CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END,
    termin;
`;

  //nowe zoptymalizowane zapytanie KEM
  const queryKEM = `
DECLARE @datado DATETIME = '${endDate}';
DECLARE @DataDoDate DATE = CAST(@datado AS DATE);
DECLARE @DataDoPlusJedenDzien DATE = DATEADD(day, 1, @DataDoDate);

WITH
-- Krok 1: Pre-agregacja rozrachunków.
cte_Rozrachunki AS (
    SELECT
        transakcja,
        SUM(kwota * SIGN(0.5 - strona)) AS WnMaRozliczono,
        SUM(CASE WHEN walutaObca IS NULL THEN kwota_w ELSE rozliczonoWO END * SIGN(0.5 - strona)) AS WnMaRozliczono_w
    FROM [Krotoski_Electromobility_2023].[FK].[rozrachunki]
    WHERE dataokr < @DataDoPlusJedenDzien AND czyRozliczenie = 1 AND potencjalna = 0
    GROUP BY transakcja
),
-- Krok 2: Przygotowanie trzech podstawowych bloków danych z wstępną agregacją.
-- Blok A: Zobowiązania - część 1
cte_Zobowiazania_Blok_A AS (
    SELECT
        dsymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.nazwa AS kontrahent,
        ROUND(
            (CASE WHEN orgstrona = 0 THEN SUM(rozdata.kwota) ELSE -SUM(rozdata.kwota) END) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM [Krotoski_Electromobility_2023].[FK].[fk_rozdata] AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN [Krotoski_Electromobility_2023].[FK].[fk_kontrahenci] AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 1 OR (rozdata.strona = 0 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND rozdata.strona = 1
    GROUP BY dsymbol, termin, orgstrona, synt, poz1, poz2, kpu.nazwa, rozdata.kurs
),
-- Blok B: Zobowiązania - część 2
cte_Zobowiazania_Blok_B AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.nazwa AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) -
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM [Krotoski_Electromobility_2023].[FK].[fk_rozdata] AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN [Krotoski_Electromobility_2023].[FK].[fk_kontrahenci] AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.baza = 2 AND rozdata.synt IN (201, 203)
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND rozdata.rozliczona = 0 AND rozdata.termin <= @DataDoDate
      AND rozdata.strona = 0 AND rozdata.kwota < 0 AND rozdata.doRozlZl > 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.nazwa
),
-- Blok C: Należności
cte_Naleznosci_Blok_C AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.nazwa AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM [Krotoski_Electromobility_2023].[FK].[fk_rozdata] AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN [Krotoski_Electromobility_2023].[FK].[fk_kontrahenci] AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND strona = 0 AND rozdata.orgStrona = 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.nazwa
),
-- Krok 3: Połączenie wstępnie zagregowanych bloków.
cte_Wszystkie_Transakcje AS (
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_A
    UNION
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_B
    UNION ALL
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Naleznosci_Blok_C
),
-- Krok 4: Końcowa, spłaszczona agregacja.
cte_Zagregowane AS (
    SELECT
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania,
        SUM(overdue) AS płatność
    FROM cte_Wszystkie_Transakcje
    GROUP BY
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania
),
-- Krok 5: Finałowe obliczenia i filtrowanie zer.
cte_WynikKoncowy AS (
    SELECT
        @DataDoDate AS stanNa,
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, płatność,
        CASE
            WHEN DniPrzetreminowania < 1   THEN '< 1'
            WHEN DniPrzetreminowania <= 30 THEN '1 - 30'
            WHEN DniPrzetreminowania <= 60 THEN '31 - 60'
            WHEN DniPrzetreminowania <= 90 THEN '61 - 90'
            WHEN DniPrzetreminowania <= 180 THEN '91 - 180'
            WHEN DniPrzetreminowania <= 360 THEN '181 - 360'
            ELSE '> 360'
        END AS przedział,
        SUM(płatność) OVER (
            PARTITION BY synt, CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END
        ) AS saldoKontrahent
    FROM cte_Zagregowane
    WHERE ROUND(płatność, 2) <> 0
)
-- Końcowy SELECT, który zwraca wynik do aplikacji.
SELECT
    stanNa,
    dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, przedział, płatność,
    ROUND(saldoKontrahent, 2) AS saldoKontrahent,
    CASE
        WHEN ROUND(saldoKontrahent, 2) > 0 THEN 'N'
        WHEN ROUND(saldoKontrahent, 2) < 0 THEN 'Z'
        ELSE 'R'
    END AS Typ
FROM cte_WynikKoncowy
ORDER BY
    synt,
    CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END,
    termin;
`;
  //nowe zoptymalizowane zapytanie RAC
  const queryRAC = `
DECLARE @datado DATETIME = '${endDate}';
DECLARE @DataDoDate DATE = CAST(@datado AS DATE);
DECLARE @DataDoPlusJedenDzien DATE = DATEADD(day, 1, @DataDoDate);

WITH
-- Krok 1: Pre-agregacja rozrachunków. To jest najlepsza praktyka i pozostaje bez zmian.
cte_Rozrachunki AS (
    SELECT
        transakcja,
        SUM(kwota * SIGN(0.5 - strona)) AS WnMaRozliczono,
        SUM(CASE WHEN walutaObca IS NULL THEN kwota_w ELSE rozliczonoWO END * SIGN(0.5 - strona)) AS WnMaRozliczono_w
    FROM FK_Rent_SK.FK.rozrachunki
    WHERE dataokr < @DataDoPlusJedenDzien AND czyRozliczenie = 1 AND potencjalna = 0
    GROUP BY transakcja
),
-- Krok 2: Przygotowanie trzech podstawowych bloków danych z wstępną agregacją.
-- Blok A: Zobowiązania - część 1
cte_Zobowiazania_Blok_A AS (
    SELECT
        dsymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            (CASE WHEN orgstrona = 0 THEN SUM(rozdata.kwota) ELSE -SUM(rozdata.kwota) END) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 1 OR (rozdata.strona = 0 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND rozdata.strona = 1
    GROUP BY dsymbol, termin, orgstrona, synt, poz1, poz2, kpu.skrot, rozdata.kurs
),
-- Blok B: Zobowiązania - część 2
cte_Zobowiazania_Blok_B AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) -
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.baza = 2 AND rozdata.synt IN (201, 203)
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND rozdata.rozliczona = 0 AND rozdata.termin <= @DataDoDate
      AND rozdata.strona = 0 AND rozdata.kwota < 0 AND rozdata.doRozlZl > 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.skrot
),
-- Blok C: Należności
cte_Naleznosci_Blok_C AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND strona = 0 AND rozdata.orgStrona = 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.skrot
),
-- Krok 3: Połączenie wstępnie zagregowanych bloków z zachowaniem oryginalnej logiki UNION / UNION ALL
cte_Wszystkie_Transakcje AS (
    -- Tutaj odtwarzamy oryginalny UNION, który usuwa duplikaty między dwoma blokami zobowiązań
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_A
    UNION
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_B
    UNION ALL
    -- A następnie dodajemy należności
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Naleznosci_Blok_C
),
-- Krok 4: Końcowa, spłaszczona agregacja. To jest znacznie wydajniejsze niż wielopoziomowe grupowanie.
cte_Zagregowane AS (
    SELECT
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania,
        SUM(overdue) AS płatność
    FROM cte_Wszystkie_Transakcje
    GROUP BY
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania
),
-- Krok 5: Finałowe obliczenia (funkcje okna, przedziały) i filtrowanie zer
cte_WynikKoncowy AS (
    SELECT
        @DataDoDate AS stanNa,
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, płatność,
        CASE
            WHEN DniPrzetreminowania < 1   THEN '< 1'
            WHEN DniPrzetreminowania <= 30 THEN '1 - 30'
            WHEN DniPrzetreminowania <= 60 THEN '31 - 60'
            WHEN DniPrzetreminowania <= 90 THEN '61 - 90'
            WHEN DniPrzetreminowania <= 180 THEN '91 - 180'
            WHEN DniPrzetreminowania <= 360 THEN '181 - 360'
            ELSE '> 360'
        END AS przedział,
        -- Warunkowe obliczanie salda
        SUM(płatność) OVER (
            PARTITION BY synt, CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END
        ) AS saldoKontrahent
    FROM cte_Zagregowane
    WHERE ROUND(płatność, 2) <> 0
)
-- Końcowy SELECT
SELECT
    stanNa,
    dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, przedział, płatność,
    ROUND(saldoKontrahent, 2) AS saldoKontrahent,
    CASE
        WHEN ROUND(saldoKontrahent, 2) > 0 THEN 'N'
        WHEN ROUND(saldoKontrahent, 2) < 0 THEN 'Z'
        ELSE 'R'
    END AS Typ
FROM cte_WynikKoncowy
ORDER BY
    synt,
    CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END,
    termin
`;
  const queries = {
    KRT: queryKRT,
    KEM: queryKEM,
    RAC: queryRAC,
  };

  return queries[company];
};

module.exports = {
  addDocumentToDatabaseQuery,
  updateDocZaLQuery,
  updateCarReleaseDatesQuery,
  updateSettlementsQuery,
  updateSettlementDescriptionQuery,
  accountancyFKData,
};
