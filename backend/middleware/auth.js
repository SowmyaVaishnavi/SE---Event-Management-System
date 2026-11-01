// EMS-F-003 / EMS-SR-004: JWT authentication and role-based access control.
// requireAuth reads the Bearer token; requireRole(...) limits a route to some roles.
// Admin builds on Organizer (SRS 7.1.2), so an Admin passes every Organizer check.
const jwt = require("jsonwebtoken");

const ROLES = ["Attendee", "Organizer", "Admin"];
const INHERITS = { Admin: ["Organizer"] };

function hasRole(userRole, allowed) {
  return allowed.includes(userRole) || (INHERITS[userRole] || []).some((r) => allowed.includes(r));
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please log in first" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.id || !ROLES.includes(payload.role)) {
      return res.status(401).json({ message: "Session expired. Please log in again" });
    }
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !hasRole(req.user.role, roles)) {
      return res.status(403).json({
        message: `You do not have access to this action. It is for ${roles.join(" or ")} accounts only`
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, hasRole, ROLES };
