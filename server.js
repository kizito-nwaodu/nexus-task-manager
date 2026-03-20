const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

// --- DEBUG ROUTE (Visit /debug to see your files) ---
app.get('/debug', (req, res) => {
    const rootFiles = fs.readdirSync(__dirname);
    let publicFiles = [];
    if (fs.existsSync(path.join(__dirname, 'public'))) {
        publicFiles = fs.readdirSync(path.join(__dirname, 'public'));
    }
    
    res.json({
        message: "Nexus Debugger",
        currentDir: __dirname,
        rootContents: rootFiles,
        publicContents: publicFiles,
        hint: publicFiles.includes('index.html') ? "index.html exists!" : "index.html is MISSING from public folder"
    });
});

// --- MAIN SERVER LOGIC ---
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('*', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
            <div style="font-family:sans-serif; padding:40px; background:#0f172a; color:white; height:100vh;">
                <h1 style="color:#6366f1">🔍 Nexus File Finder</h1>
                <p>The server is looking for: <code>${indexPath}</code></p>
                <hr style="border:1px solid #1e293b">
                <h3>Check these 3 things on GitHub:</h3>
                <ol>
                    <li>Is your folder named <b>public</b> (all lowercase)?</li>
                    <li>Is your file named <b>index.html</b> (all lowercase)?</li>
                    <li>Is the file <b>inside</b> the public folder? (Not just sitting next to it)</li>
                </ol>
                <p>Visit <a href="/debug" style="color:#818cf8">/debug</a> to see exactly what the server sees.</p>
            </div>
        `);
    }
});

app.listen(PORT, () => console.log(`Server live on ${PORT}`));
