import path from "node:path";
import type { MvpReport } from "../mvp/report-builder.js";
import { pathExists } from "../mvp/report-builder.js";
import { readJsonFile, writeJsonFile } from "../utils/fs.js";

export type AcceptanceStatus = "pending" | "accepted" | "rejected";

export interface AcceptanceRecord {
  jobName: string;
  status: AcceptanceStatus;
  updatedAt: string;
  notes: string;
}

export interface AcceptanceCommandResult {
  jobName: string;
  status: AcceptanceStatus;
  notes: string;
  acceptancePath: string;
  reportPath: string;
  acceptance: AcceptanceRecord;
}

export async function acceptanceCommand(
  jobDir: string,
  status: AcceptanceStatus,
  notes = ""
): Promise<AcceptanceCommandResult> {
  const resolvedJobDir = path.resolve(jobDir);
  const reportPath = "output/report.json";
  const absoluteReportPath = path.join(resolvedJobDir, reportPath);
  if (!await pathExists(absoluteReportPath)) {
    throw new Error("Required MVP file is missing: output/report.json. Run report and export before acceptance.");
  }

  const acceptance: AcceptanceRecord = {
    jobName: path.basename(resolvedJobDir),
    status,
    updatedAt: new Date().toISOString(),
    notes
  };
  const acceptancePath = "output/acceptance.json";
  const report = await readJsonFile<MvpReport>(absoluteReportPath);
  report.output.acceptance = acceptancePath;
  report.acceptance = {
    status,
    notes,
    updatedAt: acceptance.updatedAt
  };
  report.visualStatus = status === "accepted" ? "accepted" : status === "rejected" ? "rejected" : "needs_review";

  await writeJsonFile(path.join(resolvedJobDir, acceptancePath), acceptance);
  await writeJsonFile(absoluteReportPath, report);

  return {
    jobName: acceptance.jobName,
    status,
    notes,
    acceptancePath,
    reportPath,
    acceptance
  };
}

export async function ensurePendingAcceptance(jobDir: string): Promise<AcceptanceRecord> {
  const acceptancePath = path.join(jobDir, "output", "acceptance.json");
  if (await pathExists(acceptancePath)) {
    const acceptance = await readJsonFile<AcceptanceRecord>(acceptancePath);
    const reportPath = path.join(jobDir, "output", "report.json");
    if (await pathExists(reportPath)) {
      const report = await readJsonFile<MvpReport>(reportPath);
      report.output.acceptance = "output/acceptance.json";
      report.acceptance = {
        status: acceptance.status,
        notes: acceptance.notes,
        updatedAt: acceptance.updatedAt
      };
      report.visualStatus = acceptance.status === "accepted"
        ? "accepted"
        : acceptance.status === "rejected"
          ? "rejected"
          : "needs_review";
      await writeJsonFile(reportPath, report);
    }
    return acceptance;
  }
  return (await acceptanceCommand(jobDir, "pending")).acceptance;
}
