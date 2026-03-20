const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_enterprise_secret_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DATABASE SETUP
const db = new sqlite3.Database('./nexus.db');

db.serialize(() => {
    // Users with Roles
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')`);
    // Tasks with Timestamps
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, status TEXT, priority TEXT, userId INTEGER, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    // Messaging
    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, senderName TEXT, text TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
});

// AUTH MIDDLEWARE
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Unauthorized");
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(403).send("Forbidden");
        req.user = decoded;
        next();
    });
};

// --- AUTH API ---
app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name, adminCode } = req.body;
    const role = (adminCode === "NEXUS-ADMIN-2024") ? 'admin' : 'user';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)`, 
    [email, hashedPassword, name, role], function(err) {
        if (err) return res.status(400).json({ error: "Email already exists" });
        res.json({ message: "Account created successfully" });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, SECRET);
        res.json({ token, user: { name: user.name, role: user.role } });
    });
});

// --- TASK API (With Role Filtering) ---
app.get('/api/tasks', authenticate, (req, res) => {
    const query = req.user.role === 'admin' ? "SELECT * FROM tasks" : "SELECT * FROM tasks WHERE userId = ?";
    const params = req.user.role === 'admin' ? [] : [req.user.id];
    
    db.all(query, params, (err, rows) => res.json(rows));
});

app.post('/api/tasks', authenticate, (req, res) => {
    const { title, desc, status, priority } = req.body;
    db.run(`INSERT INTO tasks (title, desc, status, priority, userId) VALUES (?, ?, ?, ?, ?)`,
    [title, desc, status, priority, req.user.id], function() {
        res.json({ id: this.lastID });
    });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
    db.run(`UPDATE tasks SET status = ? WHERE id = ?`, [req.body.status, req.params.id], () => res.json({ success: true }));
});

// --- MESSAGING API ---
app.get('/api/messages', authenticate, (req, res) => {
    db.all("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50", (err, rows) => res.json(rows));
});

app.post('/api/messages', authenticate, (req, res) => {
    db.run("INSERT INTO messages (senderName, text) VALUES (?, ?)", [req.user.name, req.body.text], () => res.json({ success: true }));
});

// --- ANALYTICS API (Admin Only) ---
app.get('/api/admin/stats', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send("Admin only");
    
    db.all(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`, (err, rows) => {
        res.json(rows);
    });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Enterprise Server live on ${PORT}`));
