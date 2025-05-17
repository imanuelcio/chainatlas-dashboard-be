// models/Event.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const eventSchema = new Schema(
  {
    title: {
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
    },
    event_type: {
      type: String,
      required: true,
    },
    start_time: {
      type: Date,
      required: true,
    },
    end_time: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
    },
    is_virtual: {
      type: Boolean,
      default: false,
    },
    special_reward: {
      type: String,
    },
    reward_badge_id: {
      type: Schema.Types.ObjectId,
      ref: "Badge",
    },
    is_published: {
      type: Boolean,
      default: false,
    },
    max_participants: {
      type: Number,
    },
    registration_deadline: {
      type: Date,
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

// Indexes for efficient querying
eventSchema.index({ is_published: 1, start_time: 1 });
eventSchema.index({ event_type: 1, is_published: 1 });
eventSchema.index({ start_time: 1 });

// Virtual for event participants
eventSchema.virtual("participants", {
  ref: "EventParticipant",
  localField: "_id",
  foreignField: "event_id",
});

// models/EventParticipant.js
const eventParticipantSchema = new Schema({
  event_id: {
    type: Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  registration_date: {
    type: Date,
    default: Date.now,
  },
  attended: {
    type: Boolean,
    default: false,
  },
});

// Compound index for unique user-event combinations and efficient queries
eventParticipantSchema.index({ event_id: 1, user_id: 1 }, { unique: true });
eventParticipantSchema.index({ user_id: 1, registration_date: -1 });

module.exports = {
  Event: mongoose.model("Event", eventSchema),
  EventParticipant: mongoose.model("EventParticipant", eventParticipantSchema),
};
