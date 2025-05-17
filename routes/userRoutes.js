const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { validators, validate } = require("../middleware/validators");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.get("/:id", validators.userId, validate, userController.getUser);

router.get(
  "/:id/stats",
  validators.userId,
  validate,
  userController.getUserStats
);

// Protected routes (user can only access their own data)
router.put(
  "/:id",
  [protect, validators.userId, validators.username, validate],
  userController.updateUser
);

router.post(
  "/:id/connections",
  [protect, validators.userId, validate],
  userController.addUserConnection
);

router.delete(
  "/:id/connections/:platform",
  [protect, validators.userId, validate],
  userController.removeUserConnection
);

router.get(
  "/:id/connections",
  [protect, validators.userId, validate],
  userController.getUserConnections
);

// Admin only routes
router.get(
  "/",
  [protect, authorize("admin"), validators.pagination, validate],
  userController.getUsers
);

router.delete(
  "/:id",
  [protect, authorize("admin"), validators.userId, validate],
  userController.deleteUser
);

module.exports = router;
