
const companyDbMap = {
    KRT: 'AS3_KROTOSKI_PRACA',
    KEM: 'AS3_PRACA_KROTOSKI_ELECTROMOBILITY',
    RAC: 'AS3_PRACA_KROTOSKI_RENT_A_CAR',
    // dodaj więcej w razie potrzeby
};


// zapytanie do MSSQL dla wyszukania dokumnetów płatniczych dla firm: KRT, KEM, RAC i może w przyszłości kolejnych, zmienna type
const addDocumentToDatabaseQuery = (company, twoDaysAgo) => {

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

const updateSettlementsQuery = (company) => {
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

module.exports = {
    addDocumentToDatabaseQuery,
    updateDocZaLQuery,
    updateCarReleaseDatesQuery,
    updateSettlementsQuery,
    updateSettlementDescriptionQuery
};