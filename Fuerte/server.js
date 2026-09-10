/**
 * server.js
 * API REST de autenticación (JWT) + servidor de archivos estáticos.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const database = require('./database');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const SALT_ROUNDS = 10;

if (!JWT_SECRET) {
  console.error('[CONFIG ERROR] Falta la variable JWT_SECRET en el archivo .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Middlewares globales
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json());

/** Logger HTTP: [TIMESTAMP] [MÉTODO] [RUTA] - IP */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .toString()
    .replace('::ffff:', '') || 'desconocida';
  console.log(`[${timestamp}] [${req.method}] [${req.originalUrl}] - ${ip}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Endpoints de autenticación
// ---------------------------------------------------------------------------

/** POST /api/register — crea un usuario con la contraseña hasheada (bcrypt, salt 10). */
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const user = String(username).trim();

  try {
    const existente = await database.findUserByUsername(user);
    if (existente) {
      console.log(`[REGISTRO ERROR] El usuario '${user}' ya existe`);
      return res.status(409).json({ error: 'Ese nombre de usuario ya está registrado.' });
    }

    const hashed = await bcrypt.hash(String(password), SALT_ROUNDS);
    const { lastID } = await database.createUser(user, hashed);

    console.log(`[REGISTRO] Usuario creado exitosamente: ${user} (ID: ${lastID})`);
    return res.status(201).json({
      message: 'Usuario registrado correctamente.',
      user: { id: lastID, username: user },
    });
  } catch (err) {
    console.error(`[SERVER ERROR] /api/register -> ${err.message}`);
    return res.status(500).json({ error: 'Error interno al registrar el usuario.' });
  }
});

/** POST /api/login — valida credenciales y devuelve un JWT con expiración de 1h. */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios.' });
  }

  const user = String(username).trim();

  try {
    const registro = await database.findUserByUsername(user);

    if (!registro) {
      console.log(
        `[AUTH ERROR] Intento de login fallido para ${user} (Contraseña/Usuario incorrecto)`
      );
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const coincide = await bcrypt.compare(String(password), registro.password);
    if (!coincide) {
      console.log(
        `[AUTH ERROR] Intento de login fallido para ${user} (Contraseña/Usuario incorrecto)`
      );
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = jwt.sign(
      { id: registro.id, username: registro.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`[AUTH] Login exitoso para ${registro.username} -> JWT Generado`);
    return res.json({
      message: 'Autenticación correcta.',
      token,
      user: { id: registro.id, username: registro.username, createdAt: registro.createdAt },
    });
  } catch (err) {
    console.error(`[SERVER ERROR] /api/login -> ${err.message}`);
    return res.status(500).json({ error: 'Error interno al iniciar sesión.' });
  }
});

// ---------------------------------------------------------------------------
// Endpoints protegidos
// ---------------------------------------------------------------------------

/** GET /api/users — lista de usuarios sin el campo `password`. Requiere JWT. */
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await database.listUsers();
    return res.json({ total: users.length, requestedBy: req.user.username, users });
  } catch (err) {
    console.error(`[SERVER ERROR] /api/users -> ${err.message}`);
    return res.status(500).json({ error: 'Error interno al obtener los usuarios.' });
  }
});

/** GET /api/me — datos del usuario autenticado (usado por el dashboard). */
app.get('/api/me', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

// ---------------------------------------------------------------------------
// Manejo de rutas no encontradas y errores
// ---------------------------------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error(`[SERVER ERROR] ${err.message}`);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

(async () => {
  try {
    await database.init();

    const server = app.listen(PORT, () => {
      console.log('');
      console.log('==================================================');
      console.log('   SERVIDOR DE AUTENTICACIÓN Y DASHBOARD');
      console.log('==================================================');
      console.log(`   Estado          : ACTIVO`);
      console.log(`   URL             : http://localhost:${PORT}`);
      console.log(`   Puerto          : ${PORT}`);
      console.log(`   Base de datos   : CONECTADA (SQLite)`);
      console.log(`   Archivo BD      : ${database.DB_FILE}`);
      console.log(`   Expiración JWT  : ${JWT_EXPIRES_IN}`);
      console.log('--------------------------------------------------');
      console.log('   Esperando peticiones...');
      console.log('==================================================');
      console.log('');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[SERVER ERROR] El puerto ${PORT} ya está en uso.`);
        console.error('              Cierra el otro proceso o cambia PORT en el archivo .env');
      } else {
        console.error(`[SERVER ERROR] ${err.message}`);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error(`[FATAL] No se pudo iniciar el servidor: ${err.message}`);
    process.exit(1);
  }
})();

process.on('SIGINT', () => {
  console.log('\n[SERVER] Apagando servidor y cerrando la base de datos...');
  database.db.close(() => {
    console.log('[DATABASE] Conexión cerrada correctamente. Hasta pronto.');
    process.exit(0);
  });
});
