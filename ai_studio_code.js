const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_super_secret_key_123';

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Database Initialization
const db = new sqlite3.Database('./nexus.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to Nexus Database.');
});

// Create Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, tagline TEXT, color TEXT, ownerId INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, status TEXT, priority TEXT, projectId INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS team (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, role TEXT, projectId INTEGER)`);
});

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (email, password, name) VALUES (?, ?, ?)`, [email, hashed, name], function(err) {
        if (err) return res.status(400).json({ error: "User already exists" });
        res.json({ message: "User created" });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET);
        res.json({ token, name: user.name });
    });
});

// --- PROJECT ROUTES ---
app.get('/api/projects', authenticate, (req, res) => {
    db.all(`SELECT * FROM projects WHERE ownerId = ?`, [req.user.id], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/projects', authenticate, (req, res) => {
    const { name, tagline, color } = req.body;
    db.run(`INSERT INTO projects (name, tagline, color, ownerId) VALUES (?, ?, ?, ?)`, 
    [name, tagline, color, req.user.id], function(err) {
        res.json({ id: this.lastID });
    });
});

// --- TASK ROUTES ---
app.get('/api/tasks', authenticate, (req, res) => {
    db.all(`SELECT * FROM tasks`, (err, rows) => res.json(rows));
});

app.post('/api/tasks', authenticate, (req, res) => {
    const { title, desc, status, priority, projectId } = req.body;
    db.run(`INSERT INTO tasks (title, desc, status, priority, projectId) VALUES (?, ?, ?, ?, ?)`,
    [title, desc, status, priority, projectId], function() {
        res.json({ id: this.lastID });
    });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
    db.run(`UPDATE tasks SET status = ? WHERE id = ?`, [req.body.status, req.params.id], () => res.json({ success: true }));
});

// Middleware
function authenticate(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Access Denied");
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).send("Invalid Token");
        req.user = user;
        next();
    });
}

app.listen(PORT, () => console.log(`Nexus Server running on http://localhost:${PORT}`));