const { UserStats } = require("../models/UserStats");
const { UserBadge } = require("../models/Badge");
const User = require("../models/User");
const logger = require("../utils/logger");

// Get leaderboard
const getLeaderboard = async (req, res, next) => {
  try {
    const { type = "points", limit = 10 } = req.query;

    let leaderboard;

    if (type === "points") {
      // Points leaderboard
      leaderboard = await UserStats.find()
        .sort({ total_points: -1 })
        .limit(parseInt(limit))
        .populate({
          path: "user_id",
          select: "username profile_image_url",
        });
    } else if (type === "badges") {
      // Badges leaderboard
      leaderboard = await User.find()
        .sort({ total_achievements: -1 })
        .limit(parseInt(limit))
        .select("username profile_image_url total_achievements");
    } else if (type === "events") {
      // Events leaderboard
      leaderboard = await UserStats.find()
        .sort({ total_events_joined: -1 })
        .limit(parseInt(limit))
        .populate({
          path: "user_id",
          select: "username profile_image_url",
        });
    }

    res.status(200).json({ leaderboard });
  } catch (error) {
    next(error);
  }
};

// Get badge category statistics
const getBadgeStats = async (req, res, next) => {
  try {
    // Aggregate badge counts by category
    const badgeStats = await Badge.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          total_points: { $sum: "$points" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({ badgeStats });
  } catch (error) {
    next(error);
  }
};

// Get user statistics
const getUserStats = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user._id;

    const stats = await UserStats.findOne({ user_id: userId });

    if (!stats) {
      return res.status(404).json({ message: "Stats not found" });
    }

    // Get badge distribution by category
    const badgeDistribution = await UserBadge.aggregate([
      {
        $match: { user_id: mongoose.Types.ObjectId(userId) },
      },
      {
        $lookup: {
          from: "badges",
          localField: "badge_id",
          foreignField: "_id",
          as: "badge",
        },
      },
      {
        $unwind: "$badge",
      },
      {
        $group: {
          _id: "$badge.category",
          count: { $sum: 1 },
          points: { $sum: "$badge.points" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      stats,
      badge_distribution: badgeDistribution,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeaderboard,
  getBadgeStats,
  getUserStats,
};
