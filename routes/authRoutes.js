const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validators, validate } = require("../middleware/validators");
const { protect } = require("../middleware/auth");

// Public routes
router.get("/nonce/:walletAddress", authController.getNonce);
router.post(
  "/verify",
  [validators.walletAddress, validators.signature, validate],
  authController.verifySignature
);

// Protected routes
router.get("/me", protect, authController.getMe);
router.post("/logout", protect, authController.logout);

module.exports = router;
