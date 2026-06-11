const { validationResult } = require("express-validator");

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      errors: errors.array().map((item) => ({
        field: item.path,
        message: item.msg,
      })),
    });
  }
  next();
}

module.exports = { validateRequest };
