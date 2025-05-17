const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const { validators, validate } = require("../middleware/validators");
const { protect, authorize } = require("../middleware/auth");

// Public and protected routes
router.get("/", validators.pagination, validate, eventController.getEvents);

router.get("/:id", eventController.getEvent);

// User routes (needs authentication)
router.post("/:id/register", protect, eventController.registerForEvent);

router.delete("/:id/register", protect, eventController.cancelRegistration);

// Admin routes
router.post(
  "/",
  [
    protect,
    authorize("admin"),
    validators.eventTitle,
    validators.eventDescription,
    validators.eventType,
    ...validators.eventDates,
    validate,
  ],
  eventController.createEvent
);

router.put(
  "/:id",
  [
    protect,
    authorize("admin"),
    validators.eventTitle,
    validators.eventDescription,
    validators.eventType,
    ...validators.eventDates,
    validate,
  ],
  eventController.updateEvent
);

router.delete(
  "/:id",
  [protect, authorize("admin")],
  eventController.deleteEvent
);

router.patch(
  "/:id/attendance/:userId",
  [protect, authorize("admin"), validators.userId, validate],
  eventController.markAttendance
);

router.get(
  "/:id/participants",
  [protect, authorize("admin"), validators.pagination, validate],
  eventController.getEventParticipants
);

module.exports = router;
