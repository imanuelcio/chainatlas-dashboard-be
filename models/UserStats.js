// models/UserStats.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userStatsSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    total_events_joined: {
      type: Number,
      default: 0,
    },
    total_points: {
      type: Number,
      default: 0,
    },
    account_completion: {
      type: Number,
      default: 0,
    },
    achievement_progress: {
      type: Map,
      of: new Schema({
        completed: Number,
        total: Number,
      }),
      default: {},
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      updatedAt: "updated_at",
    },
  }
);

// models/UserConnection.js
const userConnectionSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  platform: {
    type: String,
    required: true,
    enum: ["discord", "twitter", "telegram", "portal_wallet", "matrica"],
  },
  platform_username: {
    type: String,
    required: true,
  },
  platform_id: {
    type: String,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  connected_at: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for unique user-platform combinations and efficient queries
userConnectionSchema.index({ user_id: 1, platform: 1 }, { unique: true });

module.exports = {
  UserStats: mongoose.model("UserStats", userStatsSchema),
  UserConnection: mongoose.model("UserConnection", userConnectionSchema),
};
