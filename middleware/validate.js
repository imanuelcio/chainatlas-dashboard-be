const { validationResult, check } = require("express-validator");

// Apply validation rules and check for errors
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    next();
  };
};

// Common validation rules
const userValidationRules = [
  check("username")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters"),
  check("email").optional().isEmail().withMessage("Invalid email format"),
  check("wallet_address")
    .optional()
    .isEthereumAddress()
    .withMessage("Invalid Ethereum address"),
];

const badgeValidationRules = [
  check("name").trim().notEmpty().withMessage("Name is required"),
  check("description").trim().notEmpty().withMessage("Description is required"),
  check("image_url").trim().isURL().withMessage("Valid image URL is required"),
  check("category").trim().notEmpty().withMessage("Category is required"),
  check("points")
    .isInt({ min: 0 })
    .withMessage("Points must be a positive integer"),
];

const eventValidationRules = [
  check("title").trim().notEmpty().withMessage("Title is required"),
  check("description").trim().notEmpty().withMessage("Description is required"),
  check("event_type").trim().notEmpty().withMessage("Event type is required"),
  check("start_time").isISO8601().withMessage("Valid start time is required"),
  check("end_time")
    .isISO8601()
    .withMessage("Valid end time is required")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_time)) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),
];

module.exports = {
  validate,
  userValidationRules,
  badgeValidationRules,
  eventValidationRules,
};
