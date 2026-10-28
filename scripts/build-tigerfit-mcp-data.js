const fs = require("fs");
const path = require("path");

const files = {};
for (const [directory, prefix] of [["llms", "llms"], ["programs/builtin", "programs/builtin"]]) {
  for (const name of fs.readdirSync(directory).filter((entry) => entry.endsWith(".md")).sort()) {
    files[`${prefix}/${name}`] = fs.readFileSync(path.join(directory, name), "utf8");
  }
}

const output = path.join(__dirname, "../cloudflare/tigerfit/reference-data.json");
fs.writeFileSync(output, `${JSON.stringify(files)}\n`);
console.log(`Bundled ${Object.keys(files).length} MCP reference files (${Buffer.byteLength(JSON.stringify(files))} bytes)`);
