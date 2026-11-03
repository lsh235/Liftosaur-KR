const fs = require("fs");
const path = require("path");

const redirectsPath = path.resolve(__dirname, "../dist/_redirects");
if (fs.existsSync(redirectsPath)) {
  fs.unlinkSync(redirectsPath);
  console.log("Removed legacy _redirects rules from the Cloudflare asset bundle.");
}

const adminSource = path.resolve(__dirname, "../cloudflare/tigerfit/admin");
const adminTarget = path.resolve(__dirname, "../dist/admin");
if (fs.existsSync(adminTarget)) fs.rmSync(adminTarget, { recursive: true, force: true });
fs.cpSync(adminSource, adminTarget, { recursive: true });
console.log("Copied TigerFit admin assets into the Cloudflare static bundle.");
