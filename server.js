const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_secret_8899';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
const db = new sqlite3.Database('./nexus.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT, name TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, name TEXT, color TEXT, ownerId INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT, desc TEXT, status TEXT, priority TEXT, projectId INTEGER)");
});

// Auth Routes
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (!user) {
            // Auto-register for testing convenience
            const hashed = await bcrypt.hash(password, 10);
            db.run("INSERT INTO users (email, password, name) VALUES (?, ?, ?)", [email, hashed, 'New User'], function() {
                const token = jwt.sign({ id: this.lastID, email }, SECRET);
                return res.json({ token, name: 'User' });
            });
        } else {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ error: "Wrong password" });
            const token = jwt.sign({ id: user.id, email: user.email }, SECRET);
            res.json({ token, name: user.name });
        }
    });
});

// App Routes
app.get('/api/tasks', authenticate, (req, res) => {
    db.all("SELECT * FROM tasks", (err, rows) => res.json(rows || []));
});

app.post('/api/tasks', authenticate, (req, res) => {
    const { title, desc, status, priority, projectId } = req.body;
    db.run("INSERT INTO tasks (title, desc, status, priority, projectId) VALUES (?, ?, ?, ?, ?)", 
    [title, desc, status, priority, projectId], function() {
        res.json({ id: this.lastID });
    });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
    db.run("UPDATE tasks SET status = ? WHERE id = ?", [req.body.status, req.params.id], () => res.json({ success: true }));
});

function authenticate(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("No token");
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).send("Invalid");
        req.user = user;
        next();
    });
}

app.listen(PORT, () => console.log(`Live at http://localhost:${PORT}`));
