/**
 * Event service to handle event-related business logic
 */
const { Event, EventParticipant } = require("../models/Event");
const { Badge, UserBadge } = require("../models/Badge");
const User = require("../models/User");
const { UserStats } = require("../models/UserStats");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * Get events with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @param {Boolean} isAdmin - Whether the requester is an admin
 * @returns {Promise<Object>} Paginated events and metadata
 */
exports.getEvents = async (
  filters = {},
  page = 1,
  limit = 10,
  isAdmin = false
) => {
  const startIndex = (page - 1) * limit;

  // Default to published events only for non-admins
  if (!isAdmin) {
    filters.is_published = true;
  }

  // Count total documents with the filter
  const totalItems = await Event.countDocuments(filters);

  // Get events with pagination
  const events = await Event.find(filters)
    .populate("reward_badge_id", "name image_url points")
    .sort({ start_time: 1 })
    .skip(startIndex)
    .limit(limit);

  // Get participant counts for each event
  const eventsWithCounts = await Promise.all(
    events.map(async (event) => {
      const participantCount = await EventParticipant.countDocuments({
        event_id: event._id,
      });
      const eventObj = event.toObject();
      eventObj.participant_count = participantCount;
      return eventObj;
    })
  );

  return {
    events: eventsWithCounts,
    pagination: {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

/**
 * Get upcoming events
 * @param {Number} limit - Number of events to return
 * @param {Boolean} isAdmin - Whether the requester is an admin
 * @returns {Promise<Array>} Upcoming events
 */
exports.getUpcomingEvents = async (limit = 5, isAdmin = false) => {
  const filter = {
    start_time: { $gte: new Date() },
  };

  // Default to published events only for non-admins
  if (!isAdmin) {
    filter.is_published = true;
  }

  const events = await Event.find(filter)
    .populate("reward_badge_id", "name image_url points")
    .sort({ start_time: 1 })
    .limit(limit);

  return events;
};

/**
 * Register a user for an event
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Registration details
 */
exports.registerUserForEvent = async (eventId, userId) => {
  // Check if event exists and is published
  const event = await Event.findOne({
    _id: eventId,
    is_published: true,
  });

  if (!event) {
    throw new Error("Event not found or not available for registration");
  }

  // Check if registration deadline has passed
  if (
    event.registration_deadline &&
    new Date(event.registration_deadline) < new Date()
  ) {
    throw new Error("Registration deadline has passed");
  }

  // Check if event is in the past
  if (new Date(event.start_time) < new Date()) {
    throw new Error("Cannot register for past events");
  }

  // Check if event has reached max participants
  if (event.max_participants) {
    const participantCount = await EventParticipant.countDocuments({
      event_id: eventId,
    });

    if (participantCount >= event.max_participants) {
      throw new Error("Event has reached maximum participants");
    }
  }

  // Check if user is already registered
  const existingRegistration = await EventParticipant.findOne({
    event_id: eventId,
    user_id: userId,
  });

  if (existingRegistration) {
    throw new Error("You are already registered for this event");
  }

  // Register the user
  const registration = await EventParticipant.create({
    event_id: eventId,
    user_id: userId,
    registration_date: new Date(),
  });

  // Increment user's total events joined count
  await UserStats.findOneAndUpdate(
    { user_id: userId },
    { $inc: { total_events_joined: 1 } },
    { upsert: true }
  );

  logger.info(`User ${userId} registered for event ${eventId}`);

  return registration;
};

/**
 * Mark user attendance for an event and award badge if needed
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID
 * @param {boolean} attended - Whether the user attended
 * @returns {Promise<boolean>} Success indicator
 */
exports.markUserAttendance = async (eventId, userId, attended) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if event exists
    const event = await Event.findById(eventId).session(session);

    if (!event) {
      await session.abortTransaction();
      session.endSession();
      throw new Error("Event not found");
    }

    // Check if user is registered for the event
    const registration = await EventParticipant.findOne({
      event_id: eventId,
      user_id: userId,
    }).session(session);

    if (!registration) {
      await session.abortTransaction();
      session.endSession();
      throw new Error("User is not registered for this event");
    }

    // Update attendance
    registration.attended = attended;
    await registration.save({ session });

    // If attended and event has a reward badge, award it to user
    if (attended && event.reward_badge_id) {
      // Check if user already has the badge
      const existingBadge = await UserBadge.findOne({
        user_id: userId,
        badge_id: event.reward_badge_id,
      }).session(session);

      if (!existingBadge) {
        // Get badge to get points
        const badge = await Badge.findById(event.reward_badge_id).session(
          session
        );

        if (badge) {
          // Award badge
          await UserBadge.create(
            [
              {
                user_id: userId,
                badge_id: event.reward_badge_id,
                earned_at: new Date(),
              },
            ],
            { session }
          );

          // Update user's total achievements
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
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(
      `Attendance for user ${userId} at event ${eventId} marked as ${
        attended ? "attended" : "not attended"
      }`
    );

    return true;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Get event participants with details
 * @param {string} eventId - Event ID
 * @param {Number} page - Page number
 * @param {Number} limit - Items per page
 * @returns {Promise<Object>} Participants and pagination information
 */
exports.getEventParticipants = async (eventId, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;

  // Check if event exists
  const event = await Event.findById(eventId);

  if (!event) {
    throw new Error("Event not found");
  }

  // Count total participants
  const totalItems = await EventParticipant.countDocuments({
    event_id: eventId,
  });

  // Get participants
  const participants = await EventParticipant.find({ event_id: eventId })
    .populate(
      "user_id",
      "username profile_image_url wallet_address total_achievements"
    )
    .sort({ registration_date: -1 })
    .skip(startIndex)
    .limit(limit);

  return {
    participants,
    pagination: {
      totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};
