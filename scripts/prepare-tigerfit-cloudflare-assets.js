const fs = require("fs");
const path = require("path");

const redirectsPath = path.resolve(__dirname, "../dist/_redirects");
if (fs.existsSync(redirectsPath)) {
  fs.unlinkSync(redirectsPath);
  console.log("Removed legacy _redirects rules from the Cloudflare asset bundle.");
}
