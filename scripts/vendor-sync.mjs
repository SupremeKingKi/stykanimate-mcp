#!/usr/bin/env node
/**
 * Re-vendor the StykAnimate application core into this package.
 *
 * The MCP server reuses the editor's own document model, rig evaluation and
 * native container codec so that a project it opens is byte-compatible with
 * the desktop app. Only the transitive import closure of the entry points
 * below is copied, so the package stays small and contains no browser-only
 * code that the server never runs.
 *
 * Usage:
 *   node scripts/vendor-sync.mjs [--source <app repo path>] [--check]
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorRoot = path.join(packageRoot, 'vendor', 'stykanimate');

/** Module roots the server actually loads. Everything else is unreachable. */
const ENTRY_POINTS = [
  'src/editor.mjs',
  'src/native-container.mjs',
  'src/native-figure.mjs',
  'src/import-wire.mjs',
  'src/demo.mjs',
  'src/startup-document.mjs',
  'src/editor-load.mjs',
];

/** Vendored third-party helpers the app's own tree references. */
const VENDOR_FILES = ['vendor/earcut.mjs', 'vendor/zstd/index.mjs', 'vendor/zstd/zstd.js', 'vendor/zstd/zstd.wasm'];

/**
 * The Python codec the server starts to read Pivot `.piv`/`.stk` files.
 *
 * It is copied under `py/` with the same `backend/` and `codecs/` layout the
 * app uses, because the codec resolves its own helpers relative to its own
 * directory.
 */
const PYTHON_PACKAGES = ['backend', 'codecs'];
const PYTHON_SKIP = /^(test_|benchmark_|profile_|build_|stage_|verify_)/;

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const sourceArg = args.indexOf('--source');

/**
 * Where the StykAnimate app lives.
 *
 * The package is usually kept next to a checkout of the app, so the sibling
 * directory is the default; an explicit path or the environment wins over it.
 */
function defaultSource() {
  if (process.env.STYKANIMATE_SOURCE) return path.resolve(process.env.STYKANIMATE_SOURCE);
  const sibling = path.join(packageRoot, '..', 'StykAnimate-App');
  if (existsSync(path.join(sibling, 'src', 'editor.mjs'))) return sibling;
  return path.join(packageRoot, '..');
}

const sourceRoot = path.resolve(sourceArg >= 0 ? args[sourceArg + 1] : defaultSource());

const STATIC_IMPORT = /(?:\bfrom\s*|\bimport\s*|\bexport\s*\*\s*from\s*|\bimport\(\s*)['"]([^'"]+)['"]/g;

async function readSource(relative) {
  return readFile(path.join(sourceRoot, relative), 'utf8');
}

/** Resolve the transitive relative-import closure of the entry points. */
export async function collectClosure(source, entries = ENTRY_POINTS) {
  const files = new Set();
  const queue = [...entries];
  const externals = new Set();
  while (queue.length) {
    const relative = path.posix.normalize(queue.pop());
    if (files.has(relative)) continue;
    if (!existsSync(path.join(source, relative))) {
      throw new Error(`Missing vendored source file: ${relative}`);
    }
    files.add(relative);
    const code = await readFile(path.join(source, relative), 'utf8');
    for (const match of code.matchAll(STATIC_IMPORT)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) {
        externals.add(specifier);
        continue;
      }
      queue.push(path.posix.join(path.posix.dirname(relative), specifier));
    }
  }
  return { files, externals };
}

/** Non-JS files the closure needs at runtime (WASM payloads and similar). */
async function collectAssets(source, files) {
  const assets = new Set();
  for (const relative of files) {
    const code = await readFile(path.join(source, relative), 'utf8');
    for (const match of code.matchAll(/['"]([\w./-]+\.(?:wasm|bin))['"]/g)) {
      const asset = path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1]));
      if (existsSync(path.join(source, asset))) assets.add(asset);
    }
  }
  return assets;
}

async function collectPython(source) {
  const files = [];
  for (const directory of PYTHON_PACKAGES) {
    const absolute = path.join(source, directory);
    if (!existsSync(absolute)) continue;
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.py')) continue;
      if (PYTHON_SKIP.test(entry.name)) continue;
      files.push(`${directory}/${entry.name}`);
    }
  }
  return files.sort();
}

async function digest(files, source) {
  const hash = createHash('sha256');
  for (const relative of [...files].sort()) {
    hash.update(relative);
    hash.update(await readFile(path.join(source, relative)));
  }
  return hash.digest('hex');
}

async function writeManifest(source, files, assets, external) {
  const manifest = {
    upstream: 'https://github.com/filippocalippo/StykAnimate-App',
    sourceCommit: safeCommit(source),
    generatedBy: 'scripts/vendor-sync.mjs',
    license: 'GPL-3.0-or-later',
    externalModules: [...external].sort(),
    files: [...files].sort(),
    assets: [...assets].sort(),
    digest: await digest(new Set([...files, ...assets]), source),
  };
  await writeFile(path.join(vendorRoot, 'PROVENANCE.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function safeCommit(source) {
  try {
    return execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  if (!existsSync(path.join(sourceRoot, 'src', 'editor.mjs'))) {
    throw new Error(`No StykAnimate source tree at ${sourceRoot}. Pass --source <path>.`);
  }
  const { files, externals } = await collectClosure(sourceRoot);
  const assets = await collectAssets(sourceRoot, files);
  const payload = new Set([...files, ...assets, ...VENDOR_FILES.filter(file => existsSync(path.join(sourceRoot, file)))]);
  const python = await collectPython(sourceRoot);

  if (checkOnly) {
    const manifestPath = path.join(vendorRoot, 'PROVENANCE.json');
    if (!existsSync(manifestPath)) {
      console.error('vendor: PROVENANCE.json is missing. Run node scripts/vendor-sync.mjs.');
      process.exitCode = 1;
      return;
    }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const current = await digest(payload, sourceRoot);
    if (current !== manifest.digest) {
      console.error('vendor: the vendored core differs from the source tree. Run node scripts/vendor-sync.mjs.');
      process.exitCode = 1;
      return;
    }
    console.log('vendor: the vendored core matches the source tree.');
    return;
  }

  await rm(vendorRoot, { recursive: true, force: true });
  await rm(path.join(packageRoot, 'py'), { recursive: true, force: true });
  await mkdir(vendorRoot, { recursive: true });
  for (const relative of payload) {
    const destination = path.join(vendorRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(sourceRoot, relative), destination);
  }
  for (const relative of python) {
    const destination = path.join(packageRoot, 'py', relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(sourceRoot, relative), destination);
  }
  const manifest = await writeManifest(sourceRoot, files, assets, externals);
  manifest.python = python;
  await writeFile(path.join(vendorRoot, 'PROVENANCE.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `vendor: copied ${manifest.files.length} modules, ${manifest.assets.length} assets and ` +
    `${python.length} Python sources (${manifest.digest.slice(0, 12)}) from ${sourceRoot}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`vendor-sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}
