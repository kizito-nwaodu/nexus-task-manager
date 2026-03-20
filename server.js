const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_top_tier_secret_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./nexus.db');

db.serialize(() => {
    // Users: role can be 'admin', 'member', or 'reader'
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, desc TEXT, color TEXT, status TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, status TEXT, priority TEXT, projectId INTEGER, userId INTEGER, date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, action TEXT, target TEXT, time DATETIME DEFAULT CURRENT_TIMESTAMP)`);
});

// Middleware
const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Unauthorized");
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(403).send("Invalid Token");
        req.user = decoded;
        next();
    });
};

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Logic: First user is Admin, others are members (or invited)
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        const role = row.count === 0 ? 'admin' : 'member';
        db.run(`INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)`, 
        [email, hashedPassword, name, role], function(err) {
            if (err) return res.status(400).json({ error: "Email exists" });
            res.json({ success: true, role });
        });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Fail" });
        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET);
        res.json({ token, user: { name: user.name, role: user.role, id: user.id } });
    });
});

// --- ADMIN: INVITE/MANAGE TEAM ---
app.get('/api/admin/users', auth, (req, res) => {
    db.all("SELECT id, name, email, role FROM users", (err, rows) => res.json(rows));
});

app.post('/api/admin/invite', auth, async (req, res) => {
    const { email, name, role } = req.body;
    const pass = await bcrypt.hash("password123", 10); // Default password
    db.run("INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)", [email, name, pass, role], () => res.json({ success: true }));
});

// --- TASKS (Role Sensitive) ---
app.get('/api/tasks', auth, (req, res) => {
    // Admins see all, Members see only assigned
    const query = req.user.role === 'admin' ? "SELECT * FROM tasks" : "SELECT * FROM tasks WHERE userId = ?";
    db.all(query, [req.user.id], (err, rows) => res.json(rows));
});

app.post('/api/tasks', auth, (req, res) => {
    const { title, desc, status, priority, userId, projectId, date } = req.body;
    db.run(`INSERT INTO tasks (title, desc, status, priority, projectId, userId, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, desc, status, priority, projectId, userId || req.user.id, date], () => res.json({ success: true }));
});

// --- GLOBAL ACTIVITY ---
app.get('/api/activities', auth, (req, res) => {
    db.all("SELECT * FROM activities ORDER BY time DESC LIMIT 10", (err, rows) => res.json(rows));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Nexus Enterprise live on ${PORT}`));
