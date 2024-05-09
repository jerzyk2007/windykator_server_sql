const express = require("express");
const router = express.Router();
const usersController = require("../../controllers/usersController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router.route("/change-pass/:_id").patch(
  // verifyRoles(ROLES_LIST.User || ROLES_LIST.FK),
  usersController.changePassword
);

router
  .route("/another-user-change-pass/:_id")
  .patch(
    verifyRoles(ROLES_LIST.Admin),
    usersController.changePasswordAnotherUser
  );

router
  .route("/change-login/:_id")
  .patch(verifyRoles(ROLES_LIST.Admin), usersController.handleChangeLogin);

router
  .route("/change-name/:_id")
  .patch(verifyRoles(ROLES_LIST.Admin), usersController.handleChangeName);

router
  .route("/change-roles/:_id")
  .patch(verifyRoles(ROLES_LIST.Admin), usersController.changeRoles);

router
  .route("/change-columns/:_id")
  .patch(verifyRoles(ROLES_LIST.Admin), usersController.changeColumns);

router
  .route("/change-permissions/:_id")
  .patch(verifyRoles(ROLES_LIST.Admin), usersController.changeUserPermissions);

router
  .route("/change-departments/:_id")
  .patch(verifyRoles(ROLES_LIST.Admin), usersController.changeUserDepartments);

router
  .route("/register")
  .post(verifyRoles(ROLES_LIST.Admin), usersController.createNewUser);

router
  .route("/delete-user/:_id")
  .delete(verifyRoles(ROLES_LIST.Admin), usersController.deleteUser);

router
  .route("/get-userdata")
  .get(verifyRoles(ROLES_LIST.Admin), usersController.getUsersData);

router
  .route("/save-table-settings/:_id")
  .patch(verifyRoles(ROLES_LIST.User), usersController.saveTableSettings);

router
  .route("/get-table-settings/:_id")
  .get(verifyRoles(ROLES_LIST.User), usersController.getTableSettings);

router
  .route("/get-columns/:_id")
  .get(verifyRoles(ROLES_LIST.User), usersController.getUserColumns);

router
  .route("/save-raport-departments-settings/:_id")
  .patch(
    verifyRoles(ROLES_LIST.User),
    usersController.saveRaporDepartmentSettings
  );

router
  .route("/get-raport-departments-settings/:_id")
  .get(
    verifyRoles(ROLES_LIST.User),
    usersController.getRaportDepartmentSettings
  );

router
  .route("/save-raport-advisers-settings/:_id")
  .patch(
    verifyRoles(ROLES_LIST.User),
    usersController.saveRaporAdviserSettings
  );

router
  .route("/get-raport-advisers-settings/:_id")
  .get(verifyRoles(ROLES_LIST.User), usersController.getRaportAdviserSettings);

module.exports = router;
