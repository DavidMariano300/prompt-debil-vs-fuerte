const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, created_at FROM users ORDER BY id DESC')
    .all();
  return res.json(users);
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  return res.json(user);
});

module.exports = router;
