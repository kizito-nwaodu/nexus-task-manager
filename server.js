const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_global_enterprise_key_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./nexus_enterprise.db');

db.serialize(() => {
    // Roles: 'admin', 'member', 'reader'
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT, role TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, status TEXT, priority TEXT, userId INTEGER, date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, userName TEXT, action TEXT, target TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
});

const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Unauthorized");
    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(403).send("Invalid Session");
        req.user = decoded;
        next();
    });
};

// --- AUTH ---
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
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

// --- ADMIN: INVITE ---
app.post('/api/admin/invite', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send("Admin Only");
    const { email, name, role } = req.body;
    const pass = await bcrypt.hash("password123", 10);
    db.run("INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)", [email, name, pass, role], () => {
        db.run("INSERT INTO activities (userName, action, target) VALUES (?, ?, ?)", [req.user.name, "invited member", name]);
        res.json({ success: true });
    });
});

app.get('/api/admin/users', auth, (req, res) => {
    db.all("SELECT id, name, email, role FROM users", (err, rows) => res.json(rows));
});

// --- WORKFLOW ---
app.get('/api/tasks', auth, (req, res) => {
    const query = req.user.role === 'admin' ? "SELECT * FROM tasks" : "SELECT * FROM tasks WHERE userId = ?";
    db.all(query, req.user.role === 'admin' ? [] : [req.user.id], (err, rows) => res.json(rows));
});

app.post('/api/tasks', auth, (req, res) => {
    const { title, desc, status, priority, date } = req.body;
    db.run(`INSERT INTO tasks (title, desc, status, priority, userId, date) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, desc, status, priority, req.user.id, date], () => {
        db.run("INSERT INTO activities (userName, action, target) VALUES (?, ?, ?)", [req.user.name, "created task", title]);
        res.json({ success: true });
    });
});

app.get('/api/activities', auth, (req, res) => {
    db.all("SELECT * FROM activities ORDER BY timestamp DESC LIMIT 10", (err, rows) => res.json(rows));
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Nexus Pro running on ${PORT}`));
