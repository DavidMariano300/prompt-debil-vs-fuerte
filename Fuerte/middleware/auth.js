/**
 * middleware/auth.js
 * Middleware de protección de rutas mediante JWT (header Authorization: Bearer <token>).
 */

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const [scheme, token] = authHeader.split(' ');

  if (!token || scheme !== 'Bearer') {
    console.log(
      `[SECURITY ALERT] Intento de acceso no autorizado a ${req.originalUrl} (Token inválido o ausente)`
    );
    return res.status(401).json({ error: 'Token no proporcionado o formato inválido.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      console.log(
        `[SECURITY ALERT] Intento de acceso no autorizado a ${req.originalUrl} (Token inválido o ausente)`
      );
      const expirado = err.name === 'TokenExpiredError';
      return res.status(401).json({
        error: expirado ? 'La sesión ha expirado. Inicia sesión de nuevo.' : 'Token inválido.',
      });
    }

    req.user = { id: payload.id, username: payload.username };
    console.log(`[SECURITY] Token válido para usuario: ${payload.username}`);
    next();
  });
}

module.exports = authMiddleware;
