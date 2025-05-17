// models/Badge.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const badgeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    image_url: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    points: {
      type: Number,
      required: true,
      default: 0,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Index for category searches
badgeSchema.index({ category: 1 });
badgeSchema.index({ name: 1 });

// models/UserBadge.js
const userBadgeSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  badge_id: {
    type: Schema.Types.ObjectId,
    ref: "Badge",
    required: true,
  },
  earned_at: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for unique user-badge combinations and efficient queries
userBadgeSchema.index({ user_id: 1, badge_id: 1 }, { unique: true });
userBadgeSchema.index({ earned_at: -1 });

// Virtual for badge details
userBadgeSchema.virtual("badge", {
  ref: "Badge",
  localField: "badge_id",
  foreignField: "_id",
  justOne: true,
});

module.exports = {
  Badge: mongoose.model("Badge", badgeSchema),
  UserBadge: mongoose.model("UserBadge", userBadgeSchema),
};
