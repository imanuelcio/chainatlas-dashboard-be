const { ethers } = require("ethers");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const config = require("../config/config");

/**
 * Generate a unique nonce for wallet authentication
 * @returns {string} A random nonce
 */
const generateNonce = () => {
  return uuidv4();
};

/**
 * Verify a signed message from a wallet
 * @param {string} message - The original message that was signed
 * @param {string} signature - The signature to verify
 * @param {string} address - The wallet address that supposedly signed the message
 * @returns {boolean} Whether the signature is valid
 */
const verifySignature = (message, signature, address) => {
  try {
    // Recover the address from the signed message
    const signerAddress = ethers.verifyMessage(message, signature);

    // Check if the recovered address matches the provided address
    return signerAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
};

/**
 * Update or create a nonce for a wallet
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {string} The generated nonce
 */
const setNonceForWallet = async (walletAddress) => {
  const nonce = generateNonce();

  // Find user by wallet address or create a new one
  const user = await User.findOneAndUpdate(
    { wallet_address: walletAddress.toLowerCase() },
    {
      nonce,
      $setOnInsert: {
        username: `user_${Date.now().toString(36)}`, // Default username if creating new user
      },
    },
    { upsert: true, new: true }
  );

  return nonce;
};

/**
 * Format a message for signing
 * @param {string} nonce - The nonce to include in the message
 * @returns {string} A formatted message for the user to sign
 */
const formatSignatureMessage = (nonce) => {
  return `Welcome to Web3 Community Platform!\n\nPlease sign this message to verify your wallet ownership.\n\nNonce: ${nonce}\n\nThis signature will not trigger a blockchain transaction or cost any gas fees.`;
};

module.exports = {
  generateNonce,
  verifySignature,
  setNonceForWallet,
  formatSignatureMessage,
};
