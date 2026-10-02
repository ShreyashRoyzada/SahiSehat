import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { redact } from "../extraction/redact";
import { EXTRACTION_VERSION, normaliseUnit, parseDate, parseReportText, validateRow, type ExtractedRow } from "../extraction/parse";
import { matchMarkerName } from "../units";
import { claudeConfigured } from "./assistant";
import { now, vaultDb } from "./db";
import type { LabFlag } from "../types";

// Report extraction, step by step (PRD "Technical requirements"):
// 1. The file is read on the person's device (PDF text layer or OCR); only text arrives here.
// 2. Rules strip name, phone, address and IDs.
// 3. Claude (if configured) extracts rows to a fixed schema; otherwise the rule-based reader does.
// 4. Validators check units, plausible ranges and flag/range agreement.
// 5. The person confirms or edits each row; only confirmed values are saved.
// No file and no unconfirmed value is stored. The upload record keeps status and timestamps only.

const RowSchema = z.object({
  rows: z.array(
    z.object({
      test_name: z.string(),
      value: z.number().nullable(),
      unit: z.string().nullable(),
      reference_range: z.string().nullable(),
      flag: z.enum(["high", "low", "normal", "critical", "none"]),
      sample_date: z.string().nullable().describe("YYYY-MM-DD"),
    }),
  ),
});

async function claudeRows(redacted: string): Promise<ExtractedRow[]> {
  const client = new Anthropic();
  const msg = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(RowSchema) },
    system:
      "You read Indian lab reports. Extract every test row for HbA1c, fasting glucose, total cholesterol, LDL, HDL, triglycerides and blood pressure exactly as printed: the test name, the value, the unit, the lab's printed reference range and flag, and the sample collection date. Never compute, convert or guess a value. Use null when something isn't printed. Personal details have been removed.",
    messages: [{ role: "user", content: redacted }],
  });
  if (msg.stop_reason === "refusal" || !msg.parsed_output) return [];
  return msg.parsed_output.rows.map((r) =>
    validateRow({
      testName: r.test_name,
      marker: matchMarkerName(r.test_name),
      value: r.value,
      unit: normaliseUnit(r.unit),
      range: r.reference_range,
      flag: (r.flag === "none" ? null : r.flag) as LabFlag,
      sampleDate: r.sample_date ? parseDate(r.sample_date) : null,
      issues: [],
    }),
  );
}

export type ExtractionResult = { uploadId: string; rows: ExtractedRow[]; engine: "rules" | "claude"; redactions: number; redactedPreview: string };

export async function extractReport(accountId: string, text: string): Promise<ExtractionResult> {
  const uploadId = randomUUID();
  const { text: redacted, removed } = redact(text.slice(0, 50_000));
  let rows: ExtractedRow[] = [];
  let engine: "rules" | "claude" = "rules";
  if (claudeConfigured()) {
    try {
      rows = await claudeRows(redacted);
      engine = "claude";
    } catch (err) {
      console.error("extract: Claude call failed, using rules", err instanceof Anthropic.APIError ? err.status : "error");
    }
  }
  if (!rows.length) {
    rows = parseReportText(redacted);
    engine = "rules";
  }
  vaultDb()
    .prepare("INSERT INTO report_uploads (id, account_id, status, extraction_version, created_at, file_deleted_at) VALUES (?, ?, 'extracted', ?, ?, ?)")
    .run(uploadId, accountId, engine === "claude" ? `claude-opus-5-5+${EXTRACTION_VERSION}` : EXTRACTION_VERSION, now(), now());
  return { uploadId, rows: rows.filter((r) => r.marker), engine, redactions: removed, redactedPreview: redacted.slice(0, 2000) };
}

export function markUploadConfirmed(accountId: string, uploadId: string) {
  vaultDb().prepare("UPDATE report_uploads SET status = 'confirmed', confirmed_at = ? WHERE id = ? AND account_id = ?").run(now(), uploadId, accountId);
}
