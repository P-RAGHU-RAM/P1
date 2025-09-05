const express = require('express');
const multer = require('multer');
const xml2js = require('xml2js');
const fs = require('fs');
const cors = require('cors');
const { create } = require('xmlbuilder2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const saltRounds = 10;
const JWT_SECRET = 'your_super_secret_key_change_this';

app.use(cors());
app.use(express.json());

let uploadedItems = [];
let userSelections = {};
let users = {};

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) {
    return res.sendStatus(401);
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password are required.');
  }
  if (users[username]) {
    return res.status(400).send('User already exists.');
  }
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  users[username] = { password: hashedPassword };
  console.log('Registered new user:', username);
  res.status(201).send('User registered successfully.');
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).send('Invalid credentials.');
  }
  const token = jwt.sign({ username: username }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.post('/api/upload', authenticateToken, upload.single('masterfile'), (req, res) => {
  fs.readFile(req.file.path, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading the file.');
    }
    xml2js.parseString(data, (err, result) => {
      if (err) {
        return res.status(500).send('Error parsing XML.');
      }
      uploadedItems = result.store.item || [];
      console.log('Master item list has been loaded by:', req.user.username);
      res.status(200).send('File uploaded and processed successfully!');
    });
  });
});

app.get('/api/items', (req, res) => {
  res.json(uploadedItems);
});

app.post('/api/submit-selections', authenticateToken, (req, res) => {
  const { selectedIds } = req.body;
  const userId = req.user.username;
  if (!userId || !selectedIds) {
    return res.status(400).send('User ID and selections are required.');
  }
  userSelections[userId] = selectedIds;
  console.log(`Selections saved for ${userId}:`, userSelections[userId]);
  res.status(200).send('Selections received successfully!');
});

app.get('/api/download-selections/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const selectedIds = userSelections[userId];
  if (!selectedIds || selectedIds.length === 0) {
    return res.status(404).send('No selections found for this user.');
  }
  const selectedItems = uploadedItems.filter(item => selectedIds.includes(item.id[0]));
  const root = create({ version: '1.0' }).ele('selections');
  for (const item of selectedItems) {
    const itemEle = root.ele('item', { category: item.$.category });
    itemEle.ele('name').txt(item.name[0]);
    itemEle.ele('id').txt(item.id[0]);
    itemEle.ele('price').txt(item.price[0]);
  }
  const xml = root.end({ prettyPrint: true });
  res.header('Content-Type', 'application/xml');
  res.header('Content-Disposition', `attachment; filename="selections_${userId}.xml"`);
  res.send(xml);
});

app.get('/api/view-by-user', authenticateToken, (req, res) => {
  const result = {};
  for (const userId in userSelections) {
    const selectedIds = userSelections[userId];
    const userItems = uploadedItems.filter(item => selectedIds.includes(item.id[0]));
    result[userId] = userItems;
  }
  res.json(result);
});

app.get('/api/view-by-item', authenticateToken, (req, res) => {
  const result = {};
  for (const userId in userSelections) {
    const selectedIds = userSelections[userId];
    for (const id of selectedIds) {
      const item = uploadedItems.find(i => i.id[0] === id);
      if (item) {
        const itemName = item.name[0];
        if (!result[itemName]) {
          result[itemName] = [];
        }
        result[itemName].push(userId);
      }
    }
  }
  res.json(result);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

