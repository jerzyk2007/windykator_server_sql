const express = require("express");
const router = express.Router();
const multer = require("multer");
const fKRaport = require("../../controllers/fkRaportController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const storage = multer.memoryStorage(); // Przechowuje plik w buforze pamięci
const upload = multer({ storage: storage });

router
  .route("/send-data-fk")
  .post(
    verifyRoles(ROLES_LIST.Admin),
    upload.single("excelFile"),
    fKRaport.documentsFromFile
  );

router.route("/get-data").post(verifyRoles(ROLES_LIST.FK), fKRaport.getData);

router
  .route("/get-new-columns")
  .get(verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK), fKRaport.getNewColumns);

router
  .route("/get-columns")
  .get(verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK), fKRaport.getColumns);

router
  .route("/change-columns")
  .patch(
    verifyRoles(ROLES_LIST.Admin && ROLES_LIST.FK),
    fKRaport.changeColumns
  );

module.exports = router;
