export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface BuildReport {
  ok: boolean;
  generatedAt: string;
  inputDir: string;
  outputDir: string;
  issues: ValidationIssue[];
  outputs: {
    projectJson?: string;
    preview?: string;
    assets?: string[];
  };
}
