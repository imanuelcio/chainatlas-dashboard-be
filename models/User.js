// models/User.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    wallet_address: {
      type: String,
      sparse: true,
      trim: true,
    },
    nonce: {
      type: String,
    },
    discord_id: {
      type: String,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    profile_image_url: {
      type: String,
    },
    total_achievements: {
      type: Number,
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

userSchema.index({ created_at: -1 });

// Virtual for user's badges
userSchema.virtual("badges", {
  ref: "UserBadge",
  localField: "_id",
  foreignField: "user_id",
});

// Virtual for user's connections
userSchema.virtual("connections", {
  ref: "UserConnection",
  localField: "_id",
  foreignField: "user_id",
});

// Virtual for user's stats
userSchema.virtual("stats", {
  ref: "UserStats",
  localField: "_id",
  foreignField: "user_id",
  justOne: true,
});

// Virtual for user's event participations
userSchema.virtual("events", {
  ref: "EventParticipant",
  localField: "_id",
  foreignField: "user_id",
});

// Virtual for user's hex locations
userSchema.virtual("hexLocations", {
  ref: "HexMapLocation",
  localField: "_id",
  foreignField: "user_id",
});

module.exports = mongoose.model("User", userSchema);
