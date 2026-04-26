const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Setup SQLite
const dbPath = path.join(__dirname, 'stats.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Could not connect to database", err);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page TEXT,
        ip TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'memory-matrix-super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Tracking Middleware
app.use((req, res, next) => {
    // Only track HTML pages or root
    if (req.path === '/' || req.path.endsWith('.html')) {
        let page = req.path === '/' ? '/index.html' : req.path;
        // Don't track admin panel views
        if (!page.includes('admin.html')) {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            db.run(`INSERT INTO visits (page, ip) VALUES (?, ?)`, [page, ip]);
        }
    }
    next();
});

// API Routes
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Falsches Passwort' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.all(`SELECT page, COUNT(*) as count FROM visits GROUP BY page ORDER BY count DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        db.get(`SELECT COUNT(*) as total FROM visits`, [], (err, totalRow) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({
                total: totalRow.total,
                pages: rows
            });
        });
    });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
});

// Admin Route protection (redirect to index if not logged in and accessing admin.html directly)
// Note: We serve admin.html as static, but it will check /api/check-auth via JS and show login form if not authenticated.
// This is simpler for a SPA-like admin dashboard.

// Serve static files
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
