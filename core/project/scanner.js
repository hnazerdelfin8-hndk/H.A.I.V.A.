// =========================================
// H.A.I.V.A. PROJECT SCANNER
// =========================================

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".vercel"
]);

const ENTRYPOINT_NAMES = new Set([
  "index.js",
  "index.mjs",
  "index.cjs",
  "index.ts",
  "index.tsx",
  "main.js",
  "main.ts",
  "app.js",
  "app.ts",
  "package.json",
  "README.md"
]);

async function walk(current, root, files, ignores) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (ignores.has(entry.name)) continue;

    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");

    if (entry.isDirectory()) {
      await walk(absolute, root, files, ignores);
    } else if (entry.isFile()) {
      const stat = await fs.stat(absolute);
      files.push({
        path: relative,
        size: stat.size,
        extension: path.extname(entry.name).toLowerCase(),
        name: entry.name,
        entrypoint: ENTRYPOINT_NAMES.has(entry.name)
      });
    }
  }
}

export async function scanProject(rootPath = process.cwd(), options = {}) {
  const root = path.resolve(rootPath);
  const ignores = new Set([...DEFAULT_IGNORES, ...(options.ignore || [])]);
  const files = [];

  const stat = await fs.stat(root);
  if (!stat.isDirectory()) throw new Error("Project root must be a directory.");

  await walk(root, root, files, ignores);
  files.sort((a, b) => a.path.localeCompare(b.path));

  const directories = new Set(files.map((file) => {
    const dir = path.posix.dirname(file.path);
    return dir === "." ? "" : dir;
  }).filter(Boolean));

  const extensions = {};
  for (const file of files) {
    const key = file.extension || "[none]";
    extensions[key] = (extensions[key] || 0) + 1;
  }

  return {
    root,
    fileCount: files.length,
    directoryCount: directories.size,
    files,
    extensions,
    entrypoints: files.filter((file) => file.entrypoint).map((file) => file.path)
  };
}
