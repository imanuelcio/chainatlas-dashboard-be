const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  console.log("MONGODB_URI:", process.env.MONGODB_URI);
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI).then(() => {
      logger.info("Connected to MongoDB");
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
