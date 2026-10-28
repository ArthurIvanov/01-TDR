const esbuild = require('esbuild');
const { spawn } = require('node:child_process');

function inlineUi() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/inline-ui.cjs'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`inline-ui exited ${code}`));
    });
  });
}

async function main() {
  const ctxMain = await esbuild.context({
    entryPoints: ['code.ts'],
    bundle: true,
    outfile: 'code.js',
    target: 'es2020',
  });

  const ctxUi = await esbuild.context({
    entryPoints: ['ui.ts'],
    bundle: true,
    outfile: 'ui.js',
    target: 'es2020',
    plugins: [
      {
        name: 'inline-ui-after-build',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length) return;
            try {
              await inlineUi();
            } catch (error) {
              console.error(error);
            }
          });
        },
      },
    ],
  });

  await Promise.all([ctxMain.watch(), ctxUi.watch()]);
  console.log('watching code.ts / ui.ts …');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
