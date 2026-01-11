const express = require("express");
const router = express.Router();
const raports = require("../../controllers/raportsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-data/:id_user/:profile")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
    raports.getDataRaport
  );

// dane struktury orgaznizacji
router
  .route("/get-organization-structure")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.DNiKN,
      ROLES_LIST.SuperAdmin
    ),
    raports.getStructureOrganization
  );

// dane różnic pomiędzy AS a FK
router
  .route("/get-fifferences-as-fk/:id_user/:profile")
  .get(
    verifyRoles(
      ROLES_LIST.Editor,
      ROLES_LIST.Raports,
      ROLES_LIST.DNiKN,
      ROLES_LIST.SuperAdmin
    ),
    raports.getRaportDifferncesAsFk
  );

// zestawienie wpłat kancelaryjnych z Symfoni
router
  .route("/get-data-raports-law-satetment")
  .get(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    raports.getRaportLawStatement
  );

// dane do raportu kontroli dokumentów BL
router
  .route("/get-data-raports-control-BL")
  .get(
    verifyRoles(ROLES_LIST.Controller, ROLES_LIST.SuperAdmin),
    raports.getRaportDocumentsControlBL
  );

module.exports = router;
