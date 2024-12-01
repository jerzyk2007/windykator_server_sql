const express = require("express");
const router = express.Router();
const multer = require("multer");
const fKRaport = require("../../controllers/fkRaportController");
const fkDataFromFile = require("../../controllers/fkDataFromFile");
const fkItemsData = require("../../controllers/fkItemsData");
const fkGenerateRaport = require("../../controllers/fkGenerateRaportController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const storage = multer.memoryStorage(); // Przechowuje plik w buforze pamięci
const upload = multer({ storage: storage });

// pobieranie danych do raportu FK wg wstępnego filtrowania
router
  .route("/get-raport-data")
  .post(verifyRoles(ROLES_LIST.FK), fKRaport.getData);

// pobiera wszytskie nazwy kolumn z pierwszego dokumnetu w DB danych FK
router
  .route("/get-new-columns")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getNewColumns);

// pobiera  nazwy kolumn zapisanych do DB
router
  .route("/get-columns")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getColumns);

//zmiana ustawień kolumn w tabeli raportu
router
  .route("/change-columns")
  .patch(verifyRoles(ROLES_LIST.FKAdmin), fKRaport.changeColumns);

//funckja odczytująca działy, ownerów, lokalizacje
router
  .route("/get-items-data")
  .get(verifyRoles(ROLES_LIST.FK), fkItemsData.getDataItems);

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
router
  .route("/get-fksettings-data")
  .get(verifyRoles(ROLES_LIST.FK), fkItemsData.getFKSettingsItems);

//funckja zapisujaca działy, ownerów, lokalizacje
router
  .route("/save-items-data/:info")
  .patch(verifyRoles(ROLES_LIST.FKAdmin), fkItemsData.saveItemsData);

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
router
  .route("/save-prepared-items")
  .patch(verifyRoles(ROLES_LIST.FK), fkItemsData.savePreparedItems);

// funkcja pobierająca kpl owner, dział, lokalizacja
router
  .route("/get-prepared-items")
  .get(verifyRoles(ROLES_LIST.FK), fkItemsData.getPreparedItems);

// funkcja pobiera unikalne nazwy działów z pliku księgowego
router
  .route("/get-uniques-dep")
  .get(verifyRoles(ROLES_LIST.FK), fkItemsData.getDepfromAccountancy);

// pobieram daty  aktualizacji plików excel dla raportu FK
router
  .route("/get-date-counter")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getDateCounter);

//do usuniecia
// pobieram przygotowane dane, przygotowane wiekowania, ownerzy, rozrachunki do wygenerowania raportu
// router
//   .route("/generate-raport")
//   .get(verifyRoles(ROLES_LIST.FK), fkGenerateRaport.generateRaport);

// usuwam wszystkie dane wczytanych plików excel raportu FK
router
  .route("/delete-data-raport")
  .get(verifyRoles(ROLES_LIST.FKAdmin), fKRaport.deleteDataRaport);

router
  .route("/check-error-raport")
  .get(verifyRoles(ROLES_LIST.FK), fkGenerateRaport.checkRaportErrors);

//funckja zapisujaca zmianę pojedyńczego itema np. ownera, wykonuje również zmianę w preparedItemsData
router
  .route("/save-item/:info")
  .patch(verifyRoles(ROLES_LIST.FK), fkItemsData.saveItem);

// zapis ustawień tabeli raportu FK
router
  .route("/save-table-settings")
  .patch(verifyRoles(ROLES_LIST.FK), fKRaport.saveTableSettings);

// pobieram wcześniejsze ustawienia tabeli FK
router
  .route("/get-table-settings")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getTableSettings);

// funkcja zapisująca kolejnosc kolumn wyświetlanych w tabeli FK i raportach EXCEL
router
  .route("/get-columns-order")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getColumnsOrder);

// pobieranie danych do front żeby odciążyć serwer
router
  .route("/prepared-items")
  .get(verifyRoles(ROLES_LIST.FKAdmin), fkDataFromFile.getPreparedItems);

// zapis do DB po zmianach i wczytaniu kolejnych plików excel
// router
//   .route("/save-data")
//   .post(verifyRoles(ROLES_LIST.FKAdmin), fkDataFromFile.savePreparedData);

// pobranie wstępnie przygotowanych danych do raportu, do dalszej obróbki
router
  .route("/get-prepared-data")
  .get(verifyRoles(ROLES_LIST.FKAdmin), fkDataFromFile.getPreparedData);

// pobiera wszytskie dane z raportu BL do dalszej obróbki dla raportu FK
router
  .route("/get-documents-BL")
  .get(verifyRoles(ROLES_LIST.FKAdmin), fkDataFromFile.getDocumentsBL);

// router
//   .route("/generate-raport-front")
//   .get(verifyRoles(ROLES_LIST.FKAdmin), fkDataFromFile.dataToGenerateRaport);

// wywołanie generowania raportu FK
router
  .route("/generate-raport")
  .get(verifyRoles(ROLES_LIST.FKAdmin), fKRaport.generateRaport);

router
  .route("/save-raport-FK")
  .post(verifyRoles(ROLES_LIST.FKAdmin), fkDataFromFile.saveRaportFK);

router
  .route("/send-accountancy-fk")
  .post(
    verifyRoles(ROLES_LIST.FKAdmin),
    fkDataFromFile.dataFkAccocuntancyFromExcel
  );

module.exports = router;
