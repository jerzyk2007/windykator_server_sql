const express = require("express");
const router = express.Router();
const organization_structure = require("../../controllers/organizationStructureController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

//dodanie nowego elementu Item
router
  .route("/new-item/:info")
  .post(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.newItem
  );

router
  .route("/get-org-str-data")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.getDataItems
  );

//usuwanie
router
  .route("/delete-item/:id/:info")
  .delete(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.deleteItem
  );

// zmiana pojedyńczego item
router
  .route("/change-item/:id/:info")
  .patch(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.changeItem
  );

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
router
  .route("/get-fksettings-data")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.getFKSettingsItems
  );

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
router
  .route("/save-prepared-items")
  .patch(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.savePreparedItems
  );

router
  .route("/delete-prepared-item/:dep/:comp")
  .delete(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.deletePreparedItem
  );

router
  .route("/check-doc-payment")
  .post(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC,
      ROLES_LIST.SuperAdmin
    ),
    organization_structure.checkDocPayment
  );

module.exports = router;
