const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_ultra_secure_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./nexus.db');

// --- DATABASE SCHEMA ---
db.serialize(() => {
    // Users
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT)`);
    // Projects
    db.run(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, desc TEXT, color TEXT, ownerId INTEGER)`);
    // Tasks (Linked to Project & User)
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, status TEXT, priority TEXT, projectId INTEGER, userId INTEGER, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    // Audit Log
    db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, userName TEXT, action TEXT, target TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
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

// --- AUTH ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid" });
        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET);
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
});

// --- USER MANAGEMENT (ADMIN) ---
app.get('/api/users', auth, (req, res) => {
    db.all(`SELECT id, name, email, role FROM users`, (err, rows) => res.json(rows));
});

app.post('/api/users/invite', auth, async (req, res) => {
    const { email, name, role } = req.body;
    const tempPass = await bcrypt.hash("password123", 10);
    db.run(`INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)`, [email, name, tempPass, role], function(err) {
        if (err) return res.status(400).send("User exists");
        logAction(req.user.name, "invited user", name);
        res.json({ success: true });
    });
});

app.delete('/api/users/:id', auth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send("Admin only");
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], () => {
        logAction(req.user.name, "removed user", `ID: ${req.params.id}`);
        res.json({ success: true });
    });
});

app.patch('/api/users/:id/role', auth, (req, res) => {
    db.run(`UPDATE users SET role = ? WHERE id = ?`, [req.body.role, req.params.id], () => {
        logAction(req.user.name, "updated role for", `User ${req.params.id} to ${req.body.role}`);
        res.json({ success: true });
    });
});

// --- PROJECTS ---
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

// --- TASKS ---
app.get('/api/tasks', auth, (req, res) => {
    db.all(`SELECT tasks.*, users.name as ownerName, projects.name as projectName 
            FROM tasks 
            LEFT JOIN users ON tasks.userId = users.id 
            LEFT JOIN projects ON tasks.projectId = projects.id`, (err, rows) => res.json(rows));
});

app.post('/api/tasks', auth, (req, res) => {
    const { title, desc, status, priority, projectId } = req.body;
    db.run(`INSERT INTO tasks (title, desc, status, priority, projectId, userId) VALUES (?, ?, ?, ?, ?, ?)`, 
    [title, desc, status, priority, projectId, req.user.id], function() {
        logAction(req.user.name, "added task", title);
        res.json({ id: this.lastID });
    });
});

// --- AUDIT LOG ---
app.get('/api/activities', auth, (req, res) => {
    db.all(`SELECT * FROM activities ORDER BY timestamp DESC LIMIT 20`, (err, rows) => res.json(rows));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Nexus Solid Enterprise running on ${PORT}`));
