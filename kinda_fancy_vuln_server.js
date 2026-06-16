const express = require('express');
const multer = require('multer');
const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('extracted')) fs.mkdirSync('extracted');

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
    res.send(`
        <h1>extract-zip Test Server</h1>
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="zip" accept=".zip">
            <button type="submit">Upload & Extract</button>
        </form>
        <hr>
        <h2>Extracted Files</h2>
        <div id="files"></div>
        <script>
            fetch('/files')
                .then(res => res.json())
                .then(files => {
                    const div = document.getElementById('files');
                    if (files.length === 0) {
                        div.innerHTML = '<p>No files extracted yet.</p>';
                        return;
                    }
                    files.forEach(file => {
                        const link = document.createElement('a');
                        link.href = '/view/' + file;
                        link.textContent = file;
                        div.appendChild(link);
                        div.appendChild(document.createElement('br'));
                    });
                });
        </script>
    `);
});

app.post('/upload', upload.single('zip'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    try {
        const extractDir = path.join(__dirname, 'extracted', req.file.filename);
        fs.mkdirSync(extractDir, { recursive: true });

        await extract(req.file.path, { dir: extractDir });

        fs.unlinkSync(req.file.path);

        res.redirect('/');
    } catch (err) {
        res.status(500).send('Extraction failed: ' + err.message);
    }
});

app.get('/files', (req, res) => {
    const extractedDir = path.join(__dirname, 'extracted');
    const dirs = fs.readdirSync(extractedDir);
    let allFiles = [];

    for (const dir of dirs) {
        const dirPath = path.join(extractedDir, dir);
        if (fs.statSync(dirPath).isDirectory()) {
            const files = fs.readdirSync(dirPath);
            allFiles = allFiles.concat(files.map(f => path.join(dir, f)));
        }
    }

    res.json(allFiles);
});

app.get('/view/:dir/:file', (req, res) => {
    const filePath = path.join(__dirname, 'extracted', req.params.dir, req.params.file);

    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(path.join(__dirname, 'extracted'))) {
        return res.status(403).send('Access Denied');
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.send(`
            <h2>${req.params.file}</h2>
            <pre>${content}</pre>
            <p><a href="/">Go back</a></p>
        `);
    } catch (err) {
        res.send(`
            <h2>${req.params.file}</h2>
            <p>Cannot display content (binary or symlink).</p>
            <p><a href="/download/${req.params.dir}/${req.params.file}">Download</a></p>
            <p><a href="/">Go back</a></p>
        `);
    }
});

app.get('/download/:dir/:file', (req, res) => {
    const filePath = path.join(__dirname, 'extracted', req.params.dir, req.params.file);

    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(path.join(__dirname, 'extracted'))) {
        return res.status(403).send('Access Denied');
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    res.download(filePath, req.params.file, (err) => {
        if (err) {
            res.status(500).send('Download failed');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
