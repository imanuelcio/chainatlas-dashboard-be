const { ethers } = require("ethers");
const logger = require("../utils/logger");
const User = require("../models/User");
const { UserConnection, UserStats } = require("../models/UserStats");
const {
  generateNonce,
  verifySignature,
  deleteNonce,
  generateToken,
} = require("../utils/auth");

// Handle wallet authentication
const handleWalletAuth = async (address) => {
  try {
    // Check if user with this wallet exists
    let user = await User.findOne({ wallet_address: address });

    if (!user) {
      // Create new user with wallet address
      user = new User({
        username: `user_${address.slice(0, 6)}`,
        wallet_address: address,
        role: "user", // Default role for wallet auth
      });

      await user.save();

      // Create initial user stats
      const { UserStats } = require("../models/UserStats");
      await UserStats.create({ user_id: user._id });

      // Add wallet as a connection
      await UserConnection.create({
        user_id: user._id,
        platform: "portal_wallet",
        platform_username: address,
        platform_id: address,
        is_verified: true,
      });
    }

    // Generate nonce for signing
    const nonce = await generateNonce(user._id);

    return { userId: user._id, nonce };
  } catch (error) {
    logger.error(`Wallet auth error: ${error.message}`);
    throw new Error("Wallet authentication failed");
  }
};

// Verify wallet signature and complete authentication
const verifyWalletSignature = async (userId, address, signature) => {
  try {
    // Get user and nonce
    const user = await User.findById(userId);

    if (!user || !user.nonce) {
      throw new Error("Invalid authentication attempt");
    }

    const message = `Sign this message to authenticate: ${user.nonce}`;

    // Verify signature with the complete message
    const isValid = await verifySignature(address, signature, message);

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Delete nonce after successful verification
    await deleteNonce(user._id);

    // Generate JWT token
    const token = generateToken(user);

    return { token, user };
  } catch (error) {
    logger.error(`Signature verification error: ${error.message}`);
    throw new Error("Signature verification failed");
  }
};

module.exports = {
  handleWalletAuth,
  verifyWalletSignature,
};
