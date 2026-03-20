const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_ultra_secure_key_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DATABASE INITIALIZATION
const db = new sqlite3.Database('./nexus.db');

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT DEFAULT 'user')`);
    // Projects Table
    db.run(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, desc TEXT, color TEXT, ownerId INTEGER)`);
    // Tasks Table
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, status TEXT, priority TEXT, projectId INTEGER, userId INTEGER, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    // Audit Activity Table
    db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, userName TEXT, action TEXT, target TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    // Support Tickets
    db.run(`CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, subject TEXT, message TEXT, status TEXT DEFAULT 'open')`);

    // Create a Default Admin if none exists
    const adminPass = bcrypt.hashSync("admin123", 10);
    db.run(`INSERT OR IGNORE INTO users (email, password, name, role) VALUES ('admin@nexus.com', ?, 'System Admin', 'admin')`, [adminPass]);
});

// HELPERS
const logAction = (name, action, target) => {
    db.run(`INSERT INTO activities (userName, action, target) VALUES (?, ?, ?)`, [name, action, target]);
};

const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Unauthorized");
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(403).send("Forbidden");
        req.user = decoded;
        next();
    });
};

// --- AUTH API ---
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, 'user')`, [email, hashed, name], function(err) {
        if (err) return res.status(400).json({ error: "Email already exists" });
        logAction(name, "joined", "Nexus Platform");
        res.json({ success: true });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid credentials" });
        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET);
        res.json({ token, user: { name: user.name, role: user.role } });
    });
});

app.post('/api/auth/forgot', (req, res) => {
    res.json({ message: "Reset link sent to " + req.body.email + " (Simulated)" });
});

// --- USER MANAGEMENT ---
app.get('/api/users', auth, (req, res) => {
    db.all(`SELECT id, name, email, role FROM users`, (err, rows) => res.json(rows));
});

app.patch('/api/users/:id/role', auth, (req, res) => {
    db.run(`UPDATE users SET role = ? WHERE id = ?`, [req.body.role, req.params.id], () => {
        logAction(req.user.name, "updated role for user ID", req.params.id);
        res.json({ success: true });
    });
});

app.delete('/api/users/:id', auth, (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], () => {
        logAction(req.user.name, "removed user ID", req.params.id);
        res.json({ success: true });
    });
});

// --- PROJECT & TASK API ---
app.get('/api/projects', auth, (req, res) => {
    db.all(`SELECT * FROM projects`, (err, rows) => res.json(rows));
});

app.post('/api/projects', auth, (req, res) => {
    const { name, desc, color } = req.body;
    db.run(`INSERT INTO projects (name, desc, color, ownerId) VALUES (?, ?, ?, ?)`, [name, desc, color, req.user.id], function() {
        logAction(req.user.name, "created project", name);
        res.json({ id: this.lastID });
    });
});

app.get('/api/tasks', auth, (req, res) => {
    const query = req.user.role === 'admin' ? "SELECT tasks.*, users.name as ownerName FROM tasks JOIN users ON tasks.userId = users.id" : "SELECT * FROM tasks WHERE userId = ?";
    db.all(query, req.user.role === 'admin' ? [] : [req.user.id], (err, rows) => res.json(rows));
});

app.post('/api/tasks', auth, (req, res) => {
    const { title, desc, status, priority, projectId } = req.body;
    db.run(`INSERT INTO tasks (title, desc, status, priority, projectId, userId) VALUES (?, ?, ?, ?, ?, ?)`, 
    [title, desc, status, priority, projectId, req.user.id], function() {
        logAction(req.user.name, "created task", title);
        res.json({ id: this.lastID });
    });
});

// --- ADMIN STATS ---
app.get('/api/admin/stats', auth, (req, res) => {
    db.get(`SELECT (SELECT COUNT(*) FROM users) as users, (SELECT COUNT(*) FROM tasks) as tasks, (SELECT COUNT(*) FROM projects) as projects`, (err, row) => res.json(row));
});

// --- AUDIT & SUPPORT ---
app.get('/api/activities', auth, (req, res) => {
    db.all(`SELECT * FROM activities ORDER BY timestamp DESC LIMIT 20`, (err, rows) => res.json(rows));
});

app.post('/api/support', auth, (req, res) => {
    db.run(`INSERT INTO support_tickets (userId, subject, message) VALUES (?, ?, ?)`, [req.user.id, req.body.subject, req.body.message], () => res.json({ success: true }));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Enterprise Platform live on ${PORT}`));
