const express = require("express");
const router = express.Router();
const passport = require("passport");
const {
  authenticateJWT,
  requireAdmin,
  requireOwnerOrAdmin,
} = require("../middleware/auth");
const {
  validate,
  userValidationRules,
  badgeValidationRules,
  eventValidationRules,
} = require("../middleware/validate");

// Import controllers
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const badgeController = require("../controllers/badgeController");
const eventController = require("../controllers/eventController");
const statsController = require("../controllers/statsController");

// Auth routes
router.post("/auth/wallet/nonce", authController.requestNonce);
router.post("/auth/wallet/verify", authController.verifyWallet);

// Discord OAuth routes
router.get(
  "/auth/discord",
  passport.authenticate("discord", {
    scope: ["identify", "email", "guilds.members.read"],
  })
);
router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", {
    session: false,
    failureRedirect: "/auth/failed",
  }),
  authController.discordCallback
);

// User routes
router.get("/users", authenticateJWT, requireAdmin, userController.getAllUsers);
router.get("/users/:id", authenticateJWT, userController.getUserById);
router.put(
  "/users/:id",
  authenticateJWT,
  requireOwnerOrAdmin("id"),
  validate(userValidationRules),
  userController.updateUser
);
router.get("/profile", authenticateJWT, authController.getProfile);

// User Connections
router.post("/connections", authenticateJWT, userController.connectPlatform);
router.delete(
  "/connections/:platform",
  authenticateJWT,
  userController.disconnectPlatform
);
router.get(
  "/users/:id/connections",
  authenticateJWT,
  userController.getUserConnections
);
router.get("/connections", authenticateJWT, userController.getUserConnections);

// Badge routes
router.post(
  "/badges",
  authenticateJWT,
  requireAdmin,
  validate(badgeValidationRules),
  badgeController.createBadge
);
router.get("/badges", badgeController.getAllBadges);
router.get("/badges/:id", badgeController.getBadgeById);
router.put(
  "/badges/:id",
  authenticateJWT,
  requireAdmin,
  validate(badgeValidationRules),
  badgeController.updateBadge
);
router.delete(
  "/badges/:id",
  authenticateJWT,
  requireAdmin,
  badgeController.deleteBadge
);
router.post(
  "/badges/award",
  authenticateJWT,
  requireAdmin,
  badgeController.awardBadge
);
router.get("/users/:userId/badges", badgeController.getUserBadges);

// Event routes
router.post(
  "/events",
  authenticateJWT,
  requireAdmin,
  validate(eventValidationRules),
  eventController.createEvent
);
router.get("/events", eventController.getAllEvents);
router.get("/events/:id", eventController.getEventById);
router.put(
  "/events/:id",
  authenticateJWT,
  requireAdmin,
  validate(eventValidationRules),
  eventController.updateEvent
);
router.delete(
  "/events/:id",
  authenticateJWT,
  requireAdmin,
  eventController.deleteEvent
);
router.post(
  "/events/:id/register",
  authenticateJWT,
  eventController.registerForEvent
);
router.delete(
  "/events/:id/register",
  authenticateJWT,
  eventController.cancelRegistration
);
router.post(
  "/events/:id/attendance",
  authenticateJWT,
  requireAdmin,
  eventController.markAttendance
);
router.get(
  "/events/:id/participants",
  authenticateJWT,
  requireAdmin,
  eventController.getEventParticipants
);

// Stats routes
router.get("/stats/leaderboard", statsController.getLeaderboard);
router.get("/stats/badges", statsController.getBadgeStats);
router.get(
  "/stats/users/:userId?",
  authenticateJWT,
  statsController.getUserStats
);

module.exports = router;
