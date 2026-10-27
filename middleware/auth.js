const jwt = require('jsonwebtoken');
const User = require('../models/users');

async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Connexion requise.'
      });
    }

    const token = authorization.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('_id role');

    if (!user) {
      return res.status(401).json({
        message: 'Utilisateur introuvable.'
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      message: 'Jeton invalide ou expiré.'
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      message: 'Accès réservé à l’administration.'
    });
  }

  return next();
}

module.exports = { requireAuth, requireAdmin };