const { Badge, UserBadge } = require("../models/Badge");
const User = require("../models/User");
const { UserStats } = require("../models/UserStats");
const logger = require("../utils/logger");

// Create badge (admin only)
const createBadge = async (req, res, next) => {
  try {
    const badge = await Badge.create(req.body);
    res.status(201).json({ badge });
  } catch (error) {
    next(error);
  }
};

// Get all badges
const getAllBadges = async (req, res, next) => {
  try {
    const { category } = req.query;
    const query = category ? { category } : {};

    const badges = await Badge.find(query).sort({ category: 1, points: -1 });

    res.status(200).json({ badges });
  } catch (error) {
    next(error);
  }
};

// Get badge by ID
const getBadgeById = async (req, res, next) => {
  try {
    const badge = await Badge.findById(req.params.id);

    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }

    res.status(200).json({ badge });
  } catch (error) {
    next(error);
  }
};

// Update badge (admin only)
const updateBadge = async (req, res, next) => {
  try {
    const badge = await Badge.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }

    res.status(200).json({ badge });
  } catch (error) {
    next(error);
  }
};

// Delete badge (admin only)
const deleteBadge = async (req, res, next) => {
  try {
    const badge = await Badge.findByIdAndDelete(req.params.id);

    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }

    // Remove badge from users
    await UserBadge.deleteMany({ badge_id: req.params.id });

    res.status(200).json({ message: "Badge deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Award badge to user (admin only)
const awardBadge = async (req, res, next) => {
  try {
    const { user_id, badge_id } = req.body;

    // Check if user exists
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if badge exists
    const badge = await Badge.findById(badge_id);
    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }

    // Check if user already has this badge
    const existingBadge = await UserBadge.findOne({ user_id, badge_id });
    if (existingBadge) {
      return res.status(409).json({ message: "User already has this badge" });
    }

    // Create user badge
    const userBadge = await UserBadge.create({
      user_id,
      badge_id,
      earned_at: new Date(),
    });

    // Update user's total achievements
    await User.findByIdAndUpdate(user_id, {
      $inc: { total_achievements: 1 },
    });

    // Update user's stats
    await UserStats.findOneAndUpdate(
      { user_id },
      { $inc: { total_points: badge.points } }
    );

    res.status(201).json({ userBadge });
  } catch (error) {
    next(error);
  }
};

// Get user's badges
const getUserBadges = async (req, res, next) => {
  try {
    const userBadges = await UserBadge.find({ user_id: req.params.userId })
      .populate("badge_id")
      .sort({ earned_at: -1 });

    res.status(200).json({ userBadges });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBadge,
  getAllBadges,
  getBadgeById,
  updateBadge,
  deleteBadge,
  awardBadge,
  getUserBadges,
};
