const path = require("path");
const express = require("express");
const app = require("./public/App.js");

const server = express();

server.use(express.static(path.join(__dirname, "public")));

server.get("*", function (req, res) {
  const { html } = app.render({ url: req.url });
  res.write(`
    <!DOCTYPE html>
    <link href="https://fonts.googleapis.com/css2?family=Dosis:wght@400;600&&display=swap" rel="stylesheet">
    <link rel='stylesheet' href='/global.css'>
    <link rel='stylesheet' href='/bundle.css'>
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div id="app">${html}</div>
    <script src="/bundle.js"></script>
    <script src="/script.js"></script>
  `);

  res.end();
});

const port = process.env.PORT || 3000
server.listen(port, () => console.log(`Listening on port ${port}`));
