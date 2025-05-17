const express = require("express");
const router = express.Router();
const badgeController = require("../controllers/badgeController");
const { validators, validate } = require("../middleware/validators");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.get("/", validators.pagination, validate, badgeController.getBadges);

router.get("/:id", badgeController.getBadge);

router.get(
  "/user/:userId",
  validators.userId,
  validate,
  badgeController.getUserBadges
);

// Admin routes
router.post(
  "/",
  [
    protect,
    authorize("admin"),
    validators.badgeName,
    validators.badgeDescription,
    validators.badgeCategory,
    validate,
  ],
  badgeController.createBadge
);

router.put(
  "/:id",
  [
    protect,
    authorize("admin"),
    validators.badgeName,
    validators.badgeDescription,
    validators.badgeCategory,
    validate,
  ],
  badgeController.updateBadge
);

router.delete(
  "/:id",
  [protect, authorize("admin")],
  badgeController.deleteBadge
);

router.post(
  "/:id/award/:userId",
  [protect, authorize("admin"), validators.userId, validate],
  badgeController.awardBadge
);

router.delete(
  "/:id/revoke/:userId",
  [protect, authorize("admin"), validators.userId, validate],
  badgeController.revokeBadge
);

module.exports = router;
