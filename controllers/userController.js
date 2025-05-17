const User = require("../models/User");
const { UserConnection, UserStats } = require("../models/UserStats");
const logger = require("../utils/logger");

// Get all users (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select("-nonce")
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 });

    const total = await User.countDocuments();

    res.status(200).json({
      users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-nonce")
      .populate("stats")
      .populate({
        path: "badges",
        populate: {
          path: "badge",
          model: "Badge",
        },
      })
      .populate({
        path: "connections",
        select: "platform platform_username is_verified connected_at",
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

// Update user profile
const updateUser = async (req, res, next) => {
  try {
    const { username, email, profile_image_url } = req.body;

    // Only admins can update roles
    const updateData = { username, email, profile_image_url };
    if (req.user.role === "admin" && req.body.role) {
      updateData.role = req.body.role;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-nonce");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

// Connect user to platform (Twitter, Discord, etc.)
const connectPlatform = async (req, res, next) => {
  try {
    const { platform, platform_username, platform_id } = req.body;

    // Validate platform
    const validPlatforms = ["twitter", "telegram", "portal_wallet", "matrica"];
    if (!validPlatforms.includes(platform) && platform !== "discord") {
      return res.status(400).json({ message: "Invalid platform" });
    }

    // Check if connection already exists
    let connection = await UserConnection.findOne({
      user_id: req.user._id,
      platform,
    });

    if (connection) {
      connection.platform_username = platform_username;
      connection.platform_id = platform_id;
      await connection.save();
    } else {
      connection = await UserConnection.create({
        user_id: req.user._id,
        platform,
        platform_username,
        platform_id,
        is_verified: platform === "discord", // Discord is verified through OAuth
      });
    }

    res.status(200).json({ connection });
  } catch (error) {
    next(error);
  }
};

// Disconnect platform
const disconnectPlatform = async (req, res, next) => {
  try {
    const { platform } = req.params;

    const result = await UserConnection.findOneAndDelete({
      user_id: req.user._id,
      platform,
    });

    if (!result) {
      return res.status(404).json({ message: "Connection not found" });
    }

    res.status(200).json({ message: "Platform disconnected successfully" });
  } catch (error) {
    next(error);
  }
};

// Get user's connections
const getUserConnections = async (req, res, next) => {
  try {
    const connections = await UserConnection.find({
      user_id: req.params.id || req.user._id,
    }).select("platform platform_username is_verified connected_at");

    res.status(200).json({ connections });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  connectPlatform,
  disconnectPlatform,
  getUserConnections,
};
