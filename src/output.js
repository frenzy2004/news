import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeReportFile(report, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
