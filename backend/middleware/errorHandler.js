/**
 * Global Error Handler Middleware
 * Catches all unhandled errors in Express routes and formats them consistently.
 */

const { StatusCodes } = {
  StatusCodes: {
    BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403,
    NOT_FOUND: 404, CONFLICT: 409, UNPROCESSABLE: 422,
    TOO_MANY: 429, INTERNAL: 500,
  },
};

/**
 * Mongoose error detector — maps DB errors to readable messages
 */
function parseMongoError(err) {
  // Duplicate key (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue?.[field];
    return {
      status: 409,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' is already registered.`,
    };
  }
  // Validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return { status: 422, message: messages.join(". ") };
  }
  // Cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return { status: 400, message: `Invalid ${err.path}: '${err.value}'` };
  }
  return null;
}

/**
 * 404 handler — attach BEFORE globalErrorHandler
 */
function notFoundHandler(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

/**
 * Global error handler — attach LAST in Express middleware chain
 */
function globalErrorHandler(err, req, res, next) {
  // Mongoose-specific errors
  const mongoError = parseMongoError(err);
  if (mongoError) {
    return res.status(mongoError.status).json({ error: mongoError.message });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid authentication token." });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "Authentication token has expired. Please log in again." });
  }

  // Explicit status from thrown errors
  const status  = err.status || err.statusCode || 500;
  const message = err.message || "An unexpected error occurred.";

  // Log server errors
  if (status >= 500) {
    console.error(`[ERROR] ${status} ${req.method} ${req.path}`);
    console.error(err.stack || err);
  }

  // Don't leak stack traces in production
  const response = { error: message };
  if (process.env.NODE_ENV !== "production" && status >= 500) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
}

/**
 * Async route wrapper — eliminates need for try/catch in every route
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { notFoundHandler, globalErrorHandler, asyncHandler };
