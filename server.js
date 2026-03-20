const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_secure_key_123'; // In production, use an environment variable

// 1. MIDDLEWARE
app.use(cors());
app.use(express.json());

// --- DYNAMIC FOLDER DETECTION ---
// This ensures we find your 'public' folder even if the casing is different
let publicFolder = 'public';
if (!fs.existsSync(path.join(__dirname, 'public')) && fs.existsSync(path.join(__dirname, 'Public'))) {
    publicFolder = 'Public';
}
const publicPath = path.join(__dirname, publicFolder);
app.use(express.static(publicPath));

// 2. DATABASE INITIALIZATION
const db = new sqlite3.Database('./nexus.db', (err) => {
    if (err) console.error("Database error:", err.message);
    else console.log("✅ Connected to Nexus Database.");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, desc TEXT, status TEXT, priority TEXT, userId INTEGER)`);
});

// 3. AUTHENTICATION MIDDLEWARE
function authenticate(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Access denied." });
    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).json({ error: "Invalid token." });
    }
}

// 4. API ROUTES

// Login & Auto-Register
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.run("INSERT INTO users (email, password, name) VALUES (?, ?, ?)", 
                [email, hashedPassword, email.split('@')[0]], function(err) {
                    const token = jwt.sign({ id: this.lastID, email }, SECRET);
                    res.json({ token, name: email.split('@')[0] });
                });
        } else {
            const validPass = await bcrypt.compare(password, user.password);
            if (!validPass) return res.status(401).json({ error: "Invalid password" });
            const token = jwt.sign({ id: user.id, email: user.email }, SECRET);
            res.json({ token, name: user.name });
        }
    });
});

// Task Management
app.get('/api/tasks', authenticate, (req, res) => {
    db.all("SELECT * FROM tasks WHERE userId = ?", [req.user.id], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/tasks', authenticate, (req, res) => {
    const { title, desc, status, priority } = req.body;
    db.run("INSERT INTO tasks (title, desc, status, priority, userId) VALUES (?, ?, ?, ?, ?)", 
        [title, desc, status || 'todo', priority || 'medium', req.user.id], function() {
            res.json({ id: this.lastID, title, status });
        });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
    db.run("UPDATE tasks SET status = ? WHERE id = ? AND userId = ?", 
        [req.body.status, req.params.id, req.user.id], () => res.json({ success: true }));
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
    db.run("DELETE FROM tasks WHERE id = ? AND userId = ?", [req.params.id, req.user.id], () => res.json({ success: true }));
});

// 5. THE SMART CATCH-ALL ROUTE (Handles the "Missing Extension" and "404" Errors)
app.get('*', (req, res) => {
    const htmlPath = path.join(publicPath, 'index.html');
    const noExtPath = path.join(publicPath, 'index'); // Handling your current 'index' file

    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else if (fs.existsSync(noExtPath)) {
        // Force the browser to treat the 'index' file as HTML
        res.setHeader('Content-Type', 'text/html');
        res.sendFile(noExtPath);
    } else {
        res.status(404).send(`
            <div style="font-family:sans-serif; padding:50px; background:#0f172a; color:white; height:100vh;">
                <h1>404: Nexus Files Not Found</h1>
                <p>Looking in: <code>${publicPath}</code></p>
                <p>Please ensure you have a file named <b>index.html</b> inside your public folder on GitHub.</p>
            </div>
        `);
    }
});

// 6. START
app.listen(PORT, () => console.log(`🚀 Nexus Server live on port ${PORT}`));
