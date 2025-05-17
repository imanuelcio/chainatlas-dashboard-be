const passport = require("passport");

// Middleware to authenticate JWT and set user in req object
const authenticateJWT = passport.authenticate("jwt", { session: false });

// Middleware to ensure user is an admin
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res
    .status(403)
    .json({ message: "Access denied: Admin role required" });
};

// Middleware to ensure user is authenticated and either owns the resource or is an admin
const requireOwnerOrAdmin = (resourceIdField) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const resourceId = req.params[resourceIdField] || req.body[resourceIdField];

    if (
      req.user.role === "admin" ||
      (resourceId && resourceId.toString() === req.user._id.toString())
    ) {
      return next();
    }

    return res
      .status(403)
      .json({ message: "Access denied: Insufficient permissions" });
  };
};

module.exports = {
  authenticateJWT,
  requireAdmin,
  requireOwnerOrAdmin,
};
