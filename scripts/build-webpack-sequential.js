const { spawnSync } = require("child_process");
const path = require("path");

const heapLimitMb = Number(process.env.WEBPACK_HEAP_LIMIT_MB || 8192);
const parallelism = Number(process.env.WEBPACK_PARALLELISM || 2);
const minifyWorkers = Number(process.env.WEBPACK_MINIFY_WORKERS || 2);
const configs = require("../webpack.config.js");

function compile(index) {
  const config = configs[index];
  if (!config) throw new Error(`Webpack config ${index} does not exist`);
  config.parallelism = parallelism;
  if (config.mode === "production" && config.optimization?.minimize !== false) {
    const TerserPlugin = require("terser-webpack-plugin");
    config.optimization.minimizer = [new TerserPlugin({
      parallel: minifyWorkers,
      terserOptions: { compress: { passes: 2 } },
    })];
  }

  const webpack = require("webpack");
  const compiler = webpack(config);
  compiler.run((error, stats) => {
    let exitCode = error ? 1 : 0;
    if (error) {
      console.error(error.stack || error);
    } else {
      process.stdout.write(`${stats.toString({ colors: process.stdout.isTTY, preset: "normal" })}\n`);
      if (stats.hasErrors()) exitCode = 1;
    }
    compiler.close((closeError) => {
      if (closeError) {
        console.error(closeError.stack || closeError);
        exitCode = 1;
      }
      process.exitCode = exitCode;
    });
  });
}

if (process.argv[2] !== undefined) {
  compile(Number(process.argv[2]));
} else {
  const nodeOptions = [process.env.NODE_OPTIONS, `--max-old-space-size=${heapLimitMb}`].filter(Boolean).join(" ");
  for (let index = 0; index < configs.length; index++) {
    console.log(`Building Webpack config ${index + 1}/${configs.length} sequentially (parallelism=${parallelism}, minifier workers=${minifyWorkers}, heap cap=${heapLimitMb} MB)`);
    const result = spawnSync(process.execPath, [path.resolve(__filename), String(index)], {
      stdio: "inherit",
      env: { ...process.env, NODE_OPTIONS: nodeOptions },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
