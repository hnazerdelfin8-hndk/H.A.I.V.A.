// =========================================
// H.A.I.V.A. PROJECT CONTEXT BUILDER
// =========================================

export function buildProjectContext(scan, analysis) {
  if (!scan || !analysis) {
    throw new Error("Project scan and analysis are required.");
  }

  const files = scan.files || [];
  const fileList = files.map((file) => file.path);
  const importantFiles = [
    ...(analysis.architecture?.entrypoints || []),
    ...(analysis.architecture?.configFiles || []),
    ...(analysis.architecture?.testFiles || [])
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  return {
    project: {
      root: scan.root,
      fileCount: scan.fileCount,
      directoryCount: scan.directoryCount
    },
    architecture: analysis.architecture,
    signals: analysis.signals,
    risks: analysis.risks,
    importantFiles,
    fileList,
    promptContext: [
      `Project root: ${scan.root}`,
      `Files: ${scan.fileCount}`,
      `Directories: ${scan.directoryCount}`,
      `Runtime files: ${analysis.summary.runtimeFileCount}`,
      `Tests detected: ${analysis.signals.hasTests ? "yes" : "no"}`,
      `API files: ${analysis.signals.hasApi ? "yes" : "no"}`,
      `Configuration detected: ${analysis.signals.hasConfig ? "yes" : "no"}`,
      `Entry points: ${(analysis.architecture.entrypoints || []).join(", ") || "none detected"}`,
      `Risks: ${analysis.risks.join(" | ") || "none detected"}`
    ].join("\n")
  };
}
