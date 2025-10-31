const express = require("express");
const router = express.Router();
const usersController = require("../../controllers/usersController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router.route("/change-pass/:id_user").patch(usersController.changePassword);

router
  .route("/another-user-change-pass/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.changePasswordAnotherUser
  );

router
  .route("/change-login/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.changeLogin
  );

router
  .route("/change-name/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.changeName
  );

router
  .route("/change-roles/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.changeUserRoles
  );

router
  .route("/change-columns/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.changeUserColumns
  );

router
  .route("/change-permissions/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.changeUserPermissions
  );

router
  .route("/change-departments/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.changeUserDepartments
  );

router
  .route("/register")
  .post(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.createNewUser
  );

router
  .route("/delete-user/:id_user")
  .delete(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.deleteUser
  );

router
  .route("/get-userdata")
  .get(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    usersController.getUsersData
  );

router
  .route("/save-table-settings/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    usersController.saveUserTableSettings
  );

router
  .route("/save-raport-departments-settings/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    usersController.saveRaporDepartmentSettings
  );

router
  .route("/get-raport-departments-settings/:id_user")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    usersController.getRaportDepartmentSettings
  );

router
  .route("/save-raport-advisers-settings/:id_user")
  .patch(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    usersController.saveRaporAdviserSettings
  );

router
  .route("/get-raport-advisers-settings/:id_user")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    usersController.getRaportAdviserSettings
  );

module.exports = router;
