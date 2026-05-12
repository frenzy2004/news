#!/usr/bin/env node
import path from "node:path";
import { generateReport } from "./report.js";
import { writeReportFile } from "./output.js";
import { findProfiles } from "./profiles.js";
import { MissingConfigError } from "./errors.js";

const DEFAULT_OUTPUT = "reports/business-relevance.json";

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const apiKey = process.env.BTW_API_KEY;

  try {
    const profiles = buildProfiles(options);
    const outputPath = path.resolve(process.cwd(), options.out);
    const report = await generateReport({
      apiKey,
      profiles,
      dateRange: options.dateRange,
      maxArticles: options.maxArticles
    });

    await writeReportFile(report, outputPath);
    console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);

    if (report.errors.length > 0) {
      console.warn(`Completed with ${report.errors.length} error(s). See errors[].`);
    }
  } catch (error) {
    if (error instanceof MissingConfigError) {
      console.error("Missing BTW_API_KEY. Set it in your environment before running.");
      process.exitCode = 1;
      return;
    }

    throw error;
  }
}

export function parseArgs(args) {
  const options = {
    out: DEFAULT_OUTPUT,
    dateRange: process.env.BTW_DATE_RANGE || "Now",
    profileIds: [],
    context: "",
    company: "Custom Business",
    website: "",
    id: "custom",
    maxArticles: 5,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--out") {
      options.out = readValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--date-range") {
      options.dateRange = readValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--profile") {
      options.profileIds.push(readValue(args, (index += 1), arg));
      continue;
    }

    if (arg === "--context") {
      options.context = readValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--company") {
      options.company = readValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--website") {
      options.website = readValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--id") {
      options.id = readValue(args, (index += 1), arg);
      continue;
    }

    if (arg === "--max-articles") {
      const value = Number.parseInt(readValue(args, (index += 1), arg), 10);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("--max-articles must be a non-negative integer.");
      }
      options.maxArticles = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function buildProfiles(options) {
  if (!options.context) {
    return findProfiles(options.profileIds);
  }

  const customProfile = {
    id: options.id,
    company: options.company,
    website: options.website,
    creatorBackground: options.context
  };

  if (options.profileIds.length === 0) {
    return [customProfile];
  }

  return [customProfile, ...findProfiles(options.profileIds)];
}

function readValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function printHelp() {
  console.log(`BTW Business Relevance JSON Generator

Usage:
  npm run generate
  node src/cli.js --out reports/custom.json

Options:
  --out <path>             Output JSON path. Default: ${DEFAULT_OUTPUT}
  --date-range <value>     BTW date range. Default: Now
  --profile <id>           Business profile to include. Repeatable.
  --context <text>         Ad hoc business context, for example "I run a fried chicken shop".
  --company <name>         Company name for --context. Default: Custom Business
  --website <url>          Website for --context.
  --id <id>                Profile id for --context. Default: custom
  --max-articles <number>  Maximum source articles per item. Default: 5
  --help                   Show this help.
`);
}
