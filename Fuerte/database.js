/**
 * database.js
 * Inicialización y capa de acceso a la base de datos SQLite.
 * Expone helpers con Promesas y logging detallado de cada consulta.
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_FILE = path.join(__dirname, 'database.sqlite');

/** Log uniforme para toda interacción con la BD. */
function logQuery(tipo) {
  console.log(`[DATABASE] Consulta ejecutada: ${tipo}`);
}

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error(`[DATABASE ERROR] No se pudo abrir la base de datos: ${err.message}`);
    process.exit(1);
  }
  console.log(`[DATABASE] Conexión establecida con SQLite -> ${DB_FILE}`);
});

/**
 * Crea la tabla `users` si no existe.
 * @returns {Promise<void>}
 */
function init() {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        username  TEXT    NOT NULL UNIQUE,
        password  TEXT    NOT NULL,
        createdAt TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `;
    db.run(sql, (err) => {
      if (err) return reject(err);
      logQuery('CREATE TABLE IF NOT EXISTS users');
      resolve();
    });
  });
}

/**
 * Ejecuta una sentencia de escritura (INSERT/UPDATE/DELETE).
 * @returns {Promise<{lastID:number, changes:number}>}
 */
function run(sql, params = [], tipo = 'RUN') {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      logQuery(tipo);
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Devuelve una sola fila.
 * @returns {Promise<Object|undefined>}
 */
function get(sql, params = [], tipo = 'SELECT (1 fila)') {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      logQuery(tipo);
      if (err) return reject(err);
      resolve(row);
    });
  });
}

/**
 * Devuelve todas las filas.
 * @returns {Promise<Array<Object>>}
 */
function all(sql, params = [], tipo = 'SELECT (n filas)') {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      logQuery(tipo);
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// ---------------------------------------------------------------------------
// Operaciones de dominio (usuarios)
// ---------------------------------------------------------------------------

/** Busca un usuario por su nombre (incluye el hash de contraseña). */
function findUserByUsername(username) {
  return get(
    'SELECT id, username, password, createdAt FROM users WHERE username = ?',
    [username],
    `SELECT users WHERE username = '${username}'`
  );
}

/** Inserta un usuario nuevo con la contraseña ya hasheada. */
function createUser(username, hashedPassword) {
  return run(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, hashedPassword],
    `INSERT INTO users (username = '${username}')`
  );
}

/** Lista todos los usuarios SIN exponer el campo `password`. */
function listUsers() {
  return all(
    'SELECT id, username, createdAt FROM users ORDER BY id ASC',
    [],
    'SELECT id, username, createdAt FROM users (sin password)'
  );
}

module.exports = {
  db,
  DB_FILE,
  init,
  run,
  get,
  all,
  findUserByUsername,
  createUser,
  listUsers,
};
