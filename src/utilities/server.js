const express = require('express');
const multer = require('multer');
const xml2js = require('xml2js');
const fs = require('fs'); // File system module

const app = express();
const port = 3000;

// Use multer to handle file uploads. This stores the file temporarily in a folder named 'uploads'.
const upload = multer({ dest: 'uploads/' });

// This is the API endpoint for uploading the file.
// 'masterfile' is the name of the input field in our HTML form.
app.post('/api/upload', upload.single('masterfile'), (req, res) => {
  console.log('File received:', req.file);

  // Read the uploaded file's content
  fs.readFile(req.file.path, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading the file.');
    }

    // Parse the XML data
    xml2js.parseString(data, (err, result) => {
      if (err) {
        return res.status(500).send('Error parsing XML.');
      }

      // For now, just log the parsed data to the console to see it works!
      console.dir(result, { depth: null });

      // Later, you'll save this 'result' to your database here.

      res.status(200).send('File uploaded and processed successfully! 🚀');
    });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});