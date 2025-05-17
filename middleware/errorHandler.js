const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((error) => error.message);
    return res.status(400).json({ message: "Validation Error", errors });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({ message: "Duplicate resource found" });
  }

  // JWT error
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }

  // Default to 500 server error
  res.status(500).json({ message: "Internal Server Error" });
};

module.exports = { errorHandler };
