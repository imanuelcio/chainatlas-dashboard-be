/**
 * Badge service to handle badge-related business logic
 */
const { Badge, UserBadge } = require("../models/Badge");
const User = require("../models/User");
const { UserStats } = require("../models/UserStats");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * Get badges with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @returns {Promise<Object>} Paginated badges and metadata
 */
exports.getBadges = async (filters = {}, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;

  // Count total documents with the filter
  const totalItems = await Badge.countDocuments(filters);

  // Get badges with pagination
  const badges = await Badge.find(filters)
    .sort({ created_at: -1 })
    .skip(startIndex)
    .limit(limit);

  return {
    badges,
    pagination: {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

/**
 * Award a badge to a user with transaction
 * @param {string} badgeId - Badge ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} The awarded badge
 */
exports.awardBadgeToUser = async (badgeId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if badge exists
    const badge = await Badge.findById(badgeId).session(session);

    if (!badge) {
      await session.abortTransaction();
      session.endSession();
      throw new Error("Badge not found");
    }

    // Check if user exists
    const user = await User.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      throw new Error("User not found");
    }

    // Check if user already has this badge
    const existingBadge = await UserBadge.findOne({
      user_id: userId,
      badge_id: badgeId,
    }).session(session);

    if (existingBadge) {
      await session.abortTransaction();
      session.endSession();
      throw new Error("User already has this badge");
    }

    // Award the badge to the user
    const userBadge = await UserBadge.create(
      [
        {
          user_id: userId,
          badge_id: badgeId,
          earned_at: new Date(),
        },
      ],
      { session }
    );

    // Update user's total achievements count
    await User.findByIdAndUpdate(
      userId,
      { $inc: { total_achievements: 1 } },
      { session }
    );

    // Update user's total points
    await UserStats.findOneAndUpdate(
      { user_id: userId },
      { $inc: { total_points: badge.points } },
      { upsert: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    logger.info(`Badge ${badgeId} awarded to user ${userId}`);

    return userBadge[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Check if a user has completed a category of badges
 * @param {string} userId - User ID
 * @param {string} category - Badge category
 * @returns {Promise<boolean>} True if all badges in category are earned
 */
exports.hasCompletedCategory = async (userId, category) => {
  // Get all badges in the category
  const categoryBadges = await Badge.find({ category });

  if (!categoryBadges.length) {
    return false;
  }

  // Get user's badges in this category
  const badgeIds = categoryBadges.map((badge) => badge._id);

  const userBadgesCount = await UserBadge.countDocuments({
    user_id: userId,
    badge_id: { $in: badgeIds },
  });

  // Check if the user has all badges in the category
  return userBadgesCount === categoryBadges.length;
};

/**
 * Get recent badge awards across all users
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Recent badge awards
 */
exports.getRecentBadgeAwards = async (limit = 10) => {
  const recentAwards = await UserBadge.find({})
    .populate("user_id", "username profile_image_url")
    .populate("badge_id")
    .sort({ earned_at: -1 })
    .limit(limit);

  return recentAwards;
};

/**
 * Get user's badge progress for a category
 * @param {string} userId - User ID
 * @param {string} category - Badge category
 * @returns {Promise<Object>} Progress information
 */
exports.getUserCategoryProgress = async (userId, category) => {
  // Get all badges in the category
  const categoryBadges = await Badge.find({ category });

  if (!categoryBadges.length) {
    return {
      category,
      total: 0,
      earned: 0,
      percentage: 0,
      remaining: [],
    };
  }

  // Get badge IDs in this category
  const badgeIds = categoryBadges.map((badge) => badge._id);

  // Get user's badges in this category
  const userBadges = await UserBadge.find({
    user_id: userId,
    badge_id: { $in: badgeIds },
  }).populate("badge_id");

  // Get IDs of earned badges
  const earnedBadgeIds = userBadges.map((ub) => ub.badge_id._id.toString());

  // Get remaining badges
  const remainingBadges = categoryBadges.filter(
    (badge) => !earnedBadgeIds.includes(badge._id.toString())
  );

  return {
    category,
    total: categoryBadges.length,
    earned: userBadges.length,
    percentage: Math.round((userBadges.length / categoryBadges.length) * 100),
    remaining: remainingBadges,
  };
};
