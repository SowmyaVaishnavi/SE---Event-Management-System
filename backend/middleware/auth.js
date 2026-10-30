// Minimal JWT auth used by the booking and check-in routes.
// NOTE: EMS-3/EMS-4 (QA Lead) owns login + RBAC. Keep these two export names
// (requireAuth, requireRole) so this file can be swapped for the QA Lead's version.
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please log in first" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this action" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
