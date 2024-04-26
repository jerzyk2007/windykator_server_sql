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

//dodaje dane już z gotowego raportu - wersja do testu
router
  .route("/send-data-fk")
  .post(
    verifyRoles(ROLES_LIST.Admin),
    upload.single("excelFile"),
    fKRaport.documentsFromFile
  );

// pobieranie danych do raportu FK wg wstępnego filtrowania
router
  .route("/get-raport-data")
  .post(verifyRoles(ROLES_LIST.FK), fKRaport.getData);

// pobiera wszytskie nazwy kolumn z pierwszego dokumnetu w DB danych FK
router
  .route("/get-new-columns")
  .get(verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK), fKRaport.getNewColumns);

// pobiera  nazwy kolumn zapisanych do DB
router
  .route("/get-columns")
  .get(verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK), fKRaport.getColumns);

//zmiana ustawień kolumn w tabeli raportu
router
  .route("/change-columns")
  .patch(verifyRoles(ROLES_LIST.Admin), fKRaport.changeColumns);

//przesyłanie danych z frontu w postaci pliku excel, dotyczy plików z danycmi do raportu FK
router
  .route("/send-documents/:type")
  .post(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    upload.single("excelFile"),
    fkDataFromFile.addDataFromFile
  );

router
  .route("/get-items-data")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkItemsData.getDataItems
  );

router
  .route("/get-fksettings-data")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkItemsData.getFKSettingsItems
  );

router
  .route("/save-items-data/:info")
  .patch(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkItemsData.saveItemsData
  );

router
  .route("/save-prepared-items")
  .patch(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkItemsData.savePreparedItems
  );

router
  .route("/get-prepared-items")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkItemsData.getPreparedItems
  );

router
  .route("/get-uniques-dep")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkItemsData.getDepfromAccountancy
  );

router
  .route("/get-date-counter")
  .get(verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK), fKRaport.getDateCounter);

router
  .route("/generate-raport")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkGenerateRaport.generateRaport
  );

router
  .route("/delete-data-raport")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fKRaport.deleteDataRaport
  );

router
  .route("/check-error-raport")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fkGenerateRaport.checkRaportErrors
  );

router
  .route("/save-item/:info")
  .patch(verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK), fkItemsData.saveItem);

router
  .route("/save-table-settings")
  .patch(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fKRaport.saveTableSettings
  );

router
  .route("/get-table-settings")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fKRaport.getTableSettings
  );

router
  .route("/get-columns-order")
  .get(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fKRaport.getColumnsOrder
  );

module.exports = router;
