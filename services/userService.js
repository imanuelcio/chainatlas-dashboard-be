/**
 * User service to handle user-related business logic
 */
const User = require("../models/User");
const { UserStats, UserConnection } = require("../models/UserStats");
const { UserBadge } = require("../models/Badge");
const { EventParticipant } = require("../models/Event");
const logger = require("../utils/logger");

/**
 * Get users with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @returns {Promise<Object>} Paginated users and metadata
 */
exports.getUsers = async (filters = {}, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;

  // Count total documents with the filter
  const totalItems = await User.countDocuments(filters);

  // Get users with pagination
  const users = await User.find(filters)
    .select("-nonce")
    .sort({ created_at: -1 })
    .skip(startIndex)
    .limit(limit);

  return {
    users,
    pagination: {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

/**
 * Get detailed user profile
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile with stats and badge/event counts
 */
exports.getUserProfile = async (userId) => {
  // Get user
  const user = await User.findById(userId).select("-nonce");

  if (!user) {
    throw new Error("User not found");
  }

  // Get user stats
  const stats = await UserStats.findOne({ user_id: userId });

  // Get badge count
  const badgeCount = await UserBadge.countDocuments({ user_id: userId });

  // Get event count
  const eventCount = await EventParticipant.countDocuments({ user_id: userId });

  // Get connection count by platform
  const connections = await UserConnection.find({ user_id: userId });
  const connectionsByPlatform = connections.reduce((acc, conn) => {
    acc[conn.platform] = {
      username: conn.platform_username,
      isVerified: conn.is_verified,
    };
    return acc;
  }, {});

  return {
    ...user.toObject(),
    stats: stats || {
      total_points: 0,
      total_events_joined: 0,
      account_completion: 0,
      achievement_progress: {},
    },
    badge_count: badgeCount,
    event_count: eventCount,
    connections: connectionsByPlatform,
  };
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @param {Boolean} isAdmin - Whether the requester is an admin
 * @returns {Promise<Object>} Updated user
 */
exports.updateUser = async (userId, updates, isAdmin = false) => {
  // Allowed fields for regular users to update
  let allowedFields = ["username", "profile_image_url"];

  // Admin can update more fields
  if (isAdmin) {
    allowedFields = [...allowedFields, "email", "role"];
  }

  // Filter out non-updatable fields
  const filteredUpdates = {};

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  // Update user
  const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
    new: true,
    runValidators: true,
  }).select("-nonce");

  if (!user) {
    throw new Error("User not found");
  }

  logger.info(`User ${userId} profile updated`);

  return user;
};

/**
 * Add or update user connection
 * @param {string} userId - User ID
 * @param {Object} connectionData - Connection data
 * @returns {Promise<Object>} The new or updated connection
 */
exports.addUserConnection = async (userId, connectionData) => {
  const { platform, platform_username, platform_id, is_verified } =
    connectionData;

  // Validate platform
  if (
    !["discord", "twitter", "telegram", "portal_wallet", "matrica"].includes(
      platform
    )
  ) {
    throw new Error("Invalid platform");
  }

  // Check if connection already exists
  const existingConnection = await UserConnection.findOne({
    user_id: userId,
    platform,
  });

  if (existingConnection) {
    // Update existing connection
    existingConnection.platform_username = platform_username;

    if (platform_id) {
      existingConnection.platform_id = platform_id;
    }

    if (typeof is_verified !== "undefined") {
      existingConnection.is_verified = is_verified;
    }

    await existingConnection.save();

    logger.info(`User ${userId} updated ${platform} connection`);

    // Update account completion
    await this.updateAccountCompletion(userId);

    return existingConnection;
  }

  // Create new connection
  const connection = await UserConnection.create({
    user_id: userId,
    platform,
    platform_username,
    platform_id,
    is_verified: is_verified || false,
    connected_at: new Date(),
  });

  // Update account completion
  await this.updateAccountCompletion(userId);

  logger.info(`User ${userId} added ${platform} connection`);

  return connection;
};

/**
 * Remove user connection
 * @param {string} userId - User ID
 * @param {string} platform - Platform name
 * @returns {Promise<boolean>} Success indicator
 */
exports.removeUserConnection = async (userId, platform) => {
  // Check if connection exists
  const connection = await UserConnection.findOne({
    user_id: userId,
    platform,
  });

  if (!connection) {
    throw new Error("Connection not found");
  }

  // Delete connection
  await connection.deleteOne();

  // Update account completion
  await this.updateAccountCompletion(userId);

  logger.info(`User ${userId} removed ${platform} connection`);

  return true;
};

/**
 * Get user connections
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of connections
 */
exports.getUserConnections = async (userId) => {
  const connections = await UserConnection.find({
    user_id: userId,
  }).sort({ connected_at: -1 });

  return connections;
};

/**
 * Update account completion percentage
 * @param {string} userId - User ID
 * @returns {Promise<number>} Completion percentage
 */
exports.updateAccountCompletion = async (userId) => {
  // Count verified connections
  const connections = await UserConnection.find({
    user_id: userId,
    is_verified: true,
  });

  // Get user
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Calculate completion percentage based on verified connections and profile info
  let completionPoints = 0;

  // Basic profile - 20%
  if (
    user.username &&
    user.username !==
      `user_${parseInt(userId.substring(0, 8), 16).toString(36)}`
  ) {
    completionPoints += 20;
  }

  // Profile image - 20%
  if (user.profile_image_url) {
    completionPoints += 20;
  }

  // Email - 20%
  if (user.email) {
    completionPoints += 20;
  }

  // Connections - up to 40% (10% each for up to 4 connections)
  const connectionPoints = Math.min(connections.length * 10, 40);
  completionPoints += connectionPoints;

  // Update user stats with completion percentage
  await UserStats.findOneAndUpdate(
    { user_id: userId },
    { account_completion: completionPoints },
    { upsert: true }
  );

  return completionPoints;
};

/**
 * Get leaderboard
 * @param {number} limit - Number of users to return
 * @returns {Promise<Array>} Top users by points
 */
exports.getLeaderboard = async (limit = 10) => {
  const leaderboard = await UserStats.find()
    .sort({ total_points: -1 })
    .limit(limit)
    .populate("user_id", "username profile_image_url total_achievements");

  return leaderboard;
};

/**
 * Get user stats
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User stats
 */
exports.getUserStats = async (userId) => {
  // Check if user exists
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  // Get user stats
  const stats = await UserStats.findOne({ user_id: userId });

  if (!stats) {
    return {
      total_points: 0,
      total_events_joined: 0,
      account_completion: 0,
      achievement_progress: {},
    };
  }

  return stats;
};
