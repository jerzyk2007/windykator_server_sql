const express = require("express");
const router = express.Router();
const fKRaport = require("../../controllers/fkRaportController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

// generowanie danych do raportu FK v2 wg wstępnego filtrowania
router
  .route("/generate-data/:company")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.generateRaportData
  );

// pobieranie raportu głównego dla zarządu - FK
router
  .route("/get-main-report/:company")
  .post(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.getMainRaportFK
  );

// pobieranie raportu głównego dla zarządu - FK
router
  .route("/get-business-report/:company")
  .post(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.getBusinessRaportFK
  );

// pobieram daty  aktualizacji plików excel dla raportu FK
router
  .route("/get-date-counter/:company")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.getDateCounter
  );

// generowanie raportu FK wersja 2 i zapisanie w tabeli
router
  .route("/create-raport/:company")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.getDataToNewRaport
  );

// usuwanie znacznika na wybranym dokumencie dla raportu fk
router
  .route("/change-mark-document")
  .patch(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.changeMark
  );

//dodaje ostateczną decyzję i datę do osobnej tabeli, dla wygenerowania historii w raporcie FK
router
  .route("/add-decision-date-fk")
  .post(verifyRoles(ROLES_LIST.User), fKRaport.addDecisionDate);

module.exports = router;
