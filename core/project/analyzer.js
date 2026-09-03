// =========================================
// H.A.I.V.A. PROJECT ANALYZER
// =========================================

const RUNTIME_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);
const CONFIG_FILES = new Set([
  "package.json",
  "vercel.json",
  "vite.config.js",
  "vite.config.ts",
  "next.config.js",
  "next.config.mjs",
  "tsconfig.json"
]);

export function analyzeProject(scan) {
  if (!scan || !Array.isArray(scan.files)) {
    throw new Error("A valid project scan is required.");
  }

  const runtimeFiles = scan.files.filter((file) => RUNTIME_EXTENSIONS.has(file.extension));
  const configFiles = scan.files.filter((file) => CONFIG_FILES.has(file.name));
  const testFiles = scan.files.filter((file) => /(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/i.test(file.path));
  const apiFiles = scan.files.filter((file) => /(^|\/)api\//i.test(file.path));
  const docs = scan.files.filter((file) => /\.(md|mdx|txt)$/i.test(file.path));

  const risks = [];
  if (runtimeFiles.length > 0 && testFiles.length === 0) {
    risks.push("No test files detected for the scanned project.");
  }
  if (runtimeFiles.length > 0 && configFiles.length === 0) {
    risks.push("No recognized project configuration file detected.");
  }

  const architecture = {
    runtimeFiles: runtimeFiles.length,
    apiFiles: apiFiles.map((file) => file.path),
    testFiles: testFiles.map((file) => file.path),
    configFiles: configFiles.map((file) => file.path),
    documentationFiles: docs.map((file) => file.path),
    entrypoints: scan.entrypoints || []
  };

  return {
    summary: {
      fileCount: scan.fileCount,
      directoryCount: scan.directoryCount,
      runtimeFileCount: runtimeFiles.length,
      testFileCount: testFiles.length
    },
    architecture,
    risks,
    signals: {
      hasTests: testFiles.length > 0,
      hasApi: apiFiles.length > 0,
      hasConfig: configFiles.length > 0,
      hasDocumentation: docs.length > 0
    }
  };
}
