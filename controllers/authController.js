const User = require("../models/User");
const { generateToken, generateNonce, deleteNonce } = require("../utils/auth");
const {
  handleWalletAuth,
  verifyWalletSignature,
} = require("../services/web3Service");
const logger = require("../utils/logger");
// handleWalletAuth,
//   verifyWalletSignature,
// Request nonce for wallet authentication

const devStatus = process.env.NODE_ENV === "development";
const requestNonce = async (req, res, next) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ message: "Wallet address is required" });
    }

    const { userId, nonce } = await handleWalletAuth(address);

    res.status(200).json({ userId, nonce });
  } catch (error) {
    next(error);
  }
};

// Verify wallet signature
const verifyWallet = async (req, res, next) => {
  try {
    const { userId, address, signature } = req.body;

    if (!userId || !address || !signature) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { token, user } = await verifyWalletSignature(
      userId,
      address,
      signature
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        profile_image_url: user.profile_image_url,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Discord authentication callback
const discordCallback = (req, res) => {
  // Generate token for the authenticated user
  const token = generateToken(req.user);

  // Redirect to frontend with token
  res.redirect(
    // devStatus
    `${process.env.FRONTEND_URL}/auth/discord/callback?token=${token}`
    // : `${process.env.FRONTEND_URL_PROD}/auth/discord/callback?token=${token}`
    // `${process.env.FRONTEND_URL_DEV}/auth/discord/callback?token=${token}`
  );
};

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("stats")
      .populate("badges")
      .populate({
        path: "connections",
        select: "platform platform_username is_verified connected_at",
      });

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Dapatkan token dari header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (req.user && req.user._id) {
      // Implementasi A: Update user record di database (opsional)
      // Misalnya mencatat waktu logout atau incrementing token version
      await User.findByIdAndUpdate(req.user._id, {
        lastLogoutAt: new Date(),
        // $inc: { tokenVersion: 1 } // Jika mengimplementasikan token versioning
      });

      // Implementasi B: Blacklist token (jika menggunakan Redis atau DB lain)
      // Simpan token ke dalam blacklist dengan waktu kedaluwarsa yang sama dengan JWT
      // Contoh dengan Redis:
      // const tokenExp = req.user.exp - Math.floor(Date.now() / 1000);
      // await redisClient.set(`bl_${token}`, 1, 'EX', tokenExp > 0 ? tokenExp : 3600);

      // Log aktivitas (opsional)
      console.log(`User ${req.user._id} logged out at ${new Date()}`);
    }

    // Respon ke client
    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Tetap kirim respon sukses meskipun ada error di server
    res.status(200).json({
      success: true,
      message: "Logged out",
    });
  }
};
module.exports = {
  requestNonce,
  verifyWallet,
  discordCallback,
  getProfile,
  logout,
};
