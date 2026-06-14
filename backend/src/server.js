require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const { Server } = require('socket.io');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const groupsRoutes = require('./routes/groups');
const expensesRoutes = require('./routes/expenses');
const summaryRoutes = require('./routes/summary');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Trust proxy - required for Render
app.set('trust proxy', 1);

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Session store
let sessionStore;
const MySQLStore = require('express-mysql-session')(session);
sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

app.use(
  session({
    key: 'connect.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api', expensesRoutes);
app.use('/api/me', summaryRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Socket.io
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  socket.on('join_expense', ({ expenseId }) => {
    socket.join(`expense_${expenseId}`);
  });

  socket.on('send_message', async ({ expenseId, userId, message }) => {
    if (!expenseId || !userId || !message || !message.trim()) return;
    try {
      const [result] = await pool.query(
        'INSERT INTO expense_messages (expense_id, user_id, message) VALUES (?, ?, ?)',
        [expenseId, userId, message.trim()]
      );
      const [rows] = await pool.query(
        `SELECT m.id, m.message, m.created_at, u.id AS user_id, u.name AS user_name
         FROM expense_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
        [result.insertId]
      );
      io.to(`expense_${expenseId}`).emit('new_message', rows[0]);
    } catch (err) {
      console.error('send_message error:', err);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});