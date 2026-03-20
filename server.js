const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

// --- DYNAMIC FOLDER DETECTION ---
// This code looks for the public folder even if you named it 'Public' or 'public'
let publicFolder = 'public';
if (!fs.existsSync(path.join(__dirname, 'public')) && fs.existsSync(path.join(__dirname, 'Public'))) {
    publicFolder = 'Public';
}

const publicPath = path.join(__dirname, publicFolder);
console.log("🚀 Server starting...");
console.log("📂 Using folder:", publicPath);

// List files for debugging
if (fs.existsSync(publicPath)) {
    console.log("📄 Files found:", fs.readdirSync(publicPath));
} else {
    console.error("❌ CRITICAL: No public folder found at all!");
    console.log("Current Directory contains:", fs.readdirSync(__dirname));
}

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.static(publicPath));

// --- API ROUTES (Keep your existing ones) ---
app.get('/api/status', (req, res) => res.json({ status: "online", folder: publicFolder }));

// --- THE CATCH-ALL (SERVES INDEX.HTML) ---
app.get('*', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    
    // Check if index.html exists, if not try Index.html
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        const altIndex = path.join(publicPath, 'Index.html');
        if (fs.existsSync(altIndex)) {
            res.sendFile(altIndex);
        } else {
            res.status(404).send(`
                <div style="font-family:sans-serif; padding:50px;">
                    <h1>404: Frontend Files Missing</h1>
                    <p>The server is looking in: <code>${publicPath}</code></p>
                    <p>But <b>index.html</b> was not found inside it.</p>
                </div>
            `);
        }
    }
});

app.listen(PORT, () => console.log(`✅ App live on port ${PORT}`));
