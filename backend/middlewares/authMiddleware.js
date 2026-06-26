const jwt = require('jsonwebtoken');

const ROLE_ORDER = {
  user: 0,
  auditor: 1,
  admin: 2,
  super_admin: 3,
};

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;

  if ((!authHeader || !authHeader.startsWith('Bearer ')) && !queryToken) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = queryToken || authHeader.slice('Bearer '.length);

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function requireRole(roles = []) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    return next();
  };
}

function hasRole(user, roles = []) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return Boolean(user?.role && allowedRoles.includes(user.role));
}

function hasMinimumRole(user, role) {
  return (ROLE_ORDER[user?.role] ?? -1) >= (ROLE_ORDER[role] ?? Number.POSITIVE_INFINITY);
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.hasRole = hasRole;
module.exports.hasMinimumRole = hasMinimumRole;
module.exports.ROLE_ORDER = ROLE_ORDER;
