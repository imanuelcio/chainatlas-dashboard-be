const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { ethers } = require("ethers");
const User = require("../models/User");

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Generate random nonce for wallet authentication
const generateNonce = async (userId) => {
  const nonce = crypto.randomBytes(32).toString("hex");
  await User.findByIdAndUpdate(userId, { nonce });
  return nonce;
};

// Verify wallet signature
const verifySignature = async (address, signature, message) => {
  try {
    const signerAddress = ethers.verifyMessage(message, signature);
    // Make addresses lowercase for case-insensitive comparison
    return signerAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    return false;
  }
};

// Delete nonce after use
const deleteNonce = async (userId) => {
  await User.findByIdAndUpdate(userId, { nonce: null });
};

module.exports = {
  generateToken,
  generateNonce,
  verifySignature,
  deleteNonce,
};
