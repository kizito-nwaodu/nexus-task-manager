const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'nexus_secure_key_99'; // In production, use an environment variable

// 1. MIDDLEWARE
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// 2. DATABASE INITIALIZATION
// This creates a file named nexus.db in your root directory
const db = new sqlite3.Database('./nexus.db', (err) => {
    if (err) console.error("Database error:", err.message);
    else console.log("Connected to Nexus Database.");
});

db.serialize(() => {
    // Create Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        email TEXT UNIQUE, 
        password TEXT, 
        name TEXT
    )`);
    
    // Create Tasks table
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        title TEXT, 
        desc TEXT, 
        status TEXT, 
        priority TEXT, 
        userId INTEGER
    )`);
});

// 3. AUTHENTICATION MIDDLEWARE
function authenticate(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).json({ error: "Invalid token." });
    }
}

// 4. API ROUTES

// Login & Auto-Register (Simplified for testing)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user) {
            // If user doesn't exist, create them (Auto-Signup Feature)
            const hashedPassword = await bcrypt.hash(password, 10);
            db.run("INSERT INTO users (email, password, name) VALUES (?, ?, ?)", 
                [email, hashedPassword, email.split('@')[0]], 
                function(err) {
                    if (err) return res.status(500).json({ error: "Registration failed" });
                    const token = jwt.sign({ id: this.lastID, email }, SECRET);
                    res.json({ token, name: email.split('@')[0], message: "Account created" });
                }
            );
        } else {
            // Verify password
            const validPass = await bcrypt.compare(password, user.password);
            if (!validPass) return res.status(401).json({ error: "Invalid password" });
            
            const token = jwt.sign({ id: user.id, email: user.email }, SECRET);
            res.json({ token, name: user.name });
        }
    });
});

// Get all tasks for logged in user
app.get('/api/tasks', authenticate, (req, res) => {
    db.all("SELECT * FROM tasks WHERE userId = ?", [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Create a new task
app.post('/api/tasks', authenticate, (req, res) => {
    const { title, desc, status, priority } = req.body;
    db.run("INSERT INTO tasks (title, desc, status, priority, userId) VALUES (?, ?, ?, ?, ?)", 
        [title, desc, status || 'todo', priority || 'medium', req.user.id], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, title, status, priority });
        }
    );
});

// Update task status (Drag & Drop)
app.put('/api/tasks/:id', authenticate, (req, res) => {
    const { status } = req.body;
    db.run("UPDATE tasks SET status = ? WHERE id = ? AND userId = ?", 
        [status, req.params.id, req.user.id], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Delete a task
app.delete('/api/tasks/:id', authenticate, (req, res) => {
    db.run("DELETE FROM tasks WHERE id = ? AND userId = ?", [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// 5. THE CATCH-ALL ROUTE (Fixes the "Not Found" error)
// This ensures that any URL that isn't an /api route serves the frontend index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 6. START SERVER
app.listen(PORT, () => {
    console.log(`
    🚀 Nexus Server is running!
    📍 Local: http://localhost:${PORT}
    📂 Serving from: ${path.join(__dirname, 'public')}
    `);
});
