const { Event, EventParticipant } = require("../models/Event");
const User = require("../models/User");
const { UserStats } = require("../models/UserStats");
const { Badge } = require("../models/Badge");
const logger = require("../utils/logger");

// Create event (admin only)
const createEvent = async (req, res, next) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
};

// Get all events with filtering
const getAllEvents = async (req, res, next) => {
  try {
    const { event_type, upcoming, past, published } = req.query;

    // Build query
    const query = {};

    if (event_type) {
      query.event_type = event_type;
    }

    if (published === "true") {
      query.is_published = true;
    } else if (published === "false" && req.user?.role === "admin") {
      query.is_published = false;
    } else {
      query.is_published = true; // Default to published for non-admins
    }

    const now = new Date();

    if (upcoming === "true") {
      query.end_time = { $gte: now };
    } else if (past === "true") {
      query.end_time = { $lt: now };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const events = await Event.find(query)
      .populate("reward_badge_id")
      .skip(skip)
      .limit(limit)
      .sort({ start_time: 1 });

    const total = await Event.countDocuments(query);

    res.status(200).json({
      events,
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

// Get event by ID
const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "reward_badge_id"
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // If the event is not published and user is not admin, return 404
    if (!event.is_published && req.user?.role !== "admin") {
      return res.status(404).json({ message: "Event not found" });
    }

    // Get participant count
    const participantCount = await EventParticipant.countDocuments({
      event_id: req.params.id,
    });

    // Check if current user is registered
    let isRegistered = false;
    if (req.user) {
      isRegistered = await EventParticipant.exists({
        event_id: req.params.id,
        user_id: req.user._id,
      });
    }

    res.status(200).json({
      event,
      participant_count: participantCount,
      is_registered: isRegistered || false,
    });
  } catch (error) {
    next(error);
  }
};

// Update event (admin only)
const updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(200).json({ event });
  } catch (error) {
    next(error);
  }
};

// Delete event (admin only)
const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Remove all participants
    await EventParticipant.deleteMany({ event_id: req.params.id });

    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// Register for event
const registerForEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if event is published
    if (!event.is_published) {
      return res
        .status(400)
        .json({ message: "Cannot register for unpublished event" });
    }

    // Check if event registration is still open
    if (
      event.registration_deadline &&
      new Date() > new Date(event.registration_deadline)
    ) {
      return res
        .status(400)
        .json({ message: "Registration deadline has passed" });
    }

    // Check if event is full
    if (event.max_participants) {
      const participantCount = await EventParticipant.countDocuments({
        event_id: req.params.id,
      });
      if (participantCount >= event.max_participants) {
        return res.status(400).json({ message: "Event is full" });
      }
    }

    // Check if user is already registered
    const existingRegistration = await EventParticipant.findOne({
      event_id: req.params.id,
      user_id: req.user._id,
    });

    if (existingRegistration) {
      return res
        .status(409)
        .json({ message: "Already registered for this event" });
    }

    // Create registration
    const eventParticipant = await EventParticipant.create({
      event_id: req.params.id,
      user_id: req.user._id,
      registration_date: new Date(),
    });

    // Update user stats
    await UserStats.findOneAndUpdate(
      { user_id: req.user._id },
      { $inc: { total_events_joined: 1 } }
    );

    res.status(201).json({ eventParticipant });
  } catch (error) {
    next(error);
  }
};

// Cancel registration
const cancelRegistration = async (req, res, next) => {
  try {
    const result = await EventParticipant.findOneAndDelete({
      event_id: req.params.id,
      user_id: req.user._id,
    });

    if (!result) {
      return res.status(404).json({ message: "Registration not found" });
    }

    // Update user stats
    await UserStats.findOneAndUpdate(
      { user_id: req.user._id },
      { $inc: { total_events_joined: -1 } }
    );

    res.status(200).json({ message: "Registration canceled successfully" });
  } catch (error) {
    next(error);
  }
};

// Mark attendance (admin only)
const markAttendance = async (req, res, next) => {
  try {
    const { user_id, attended } = req.body;

    const eventParticipant = await EventParticipant.findOne({
      event_id: req.params.id,
      user_id,
    });

    if (!eventParticipant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    eventParticipant.attended = attended;
    await eventParticipant.save();

    // If attended and the event has a reward badge, award it
    if (attended) {
      const event = await Event.findById(req.params.id);

      if (event.reward_badge_id) {
        // Check if user already has this badge
        const existingBadge = await UserBadge.findOne({
          user_id,
          badge_id: event.reward_badge_id,
        });

        if (!existingBadge) {
          // Get badge points
          const badge = await Badge.findById(event.reward_badge_id);

          // Award badge
          await UserBadge.create({
            user_id,
            badge_id: event.reward_badge_id,
            earned_at: new Date(),
          });

          // Update user stats
          await User.findByIdAndUpdate(user_id, {
            $inc: { total_achievements: 1 },
          });

          await UserStats.findOneAndUpdate(
            { user_id },
            { $inc: { total_points: badge.points } }
          );
        }
      }
    }

    res.status(200).json({ eventParticipant });
  } catch (error) {
    next(error);
  }
};

// Get event participants (admin only)
const getEventParticipants = async (req, res, next) => {
  try {
    const participants = await EventParticipant.find({
      event_id: req.params.id,
    })
      .populate({
        path: "user_id",
        select: "username profile_image_url",
      })
      .sort({ registration_date: 1 });

    res.status(200).json({ participants });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
  cancelRegistration,
  markAttendance,
  getEventParticipants,
};
