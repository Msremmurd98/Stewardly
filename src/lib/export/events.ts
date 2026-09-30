import ExcelJS from "exceljs";
import Papa from "papaparse";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { attendanceLabel, formatDateTime, safeFileName } from "@/lib/events";
import { downloadBlob } from "./download";
import { EVENT_SELECT } from "@/hooks/useEvents";
import type { EventRegistrationWithRelations, EventRow } from "@/types/events";

/**
 * Every export re-reads the database at click time (never React Query's cache),
 * so an approval made a second ago is already reflected. The database is the
 * source of truth - there is no separately maintained spreadsheet.
 */
async function fetchLatest(eventId: string): Promise<{
  event: EventRow;
  registrations: EventRegistrationWithRelations[];
}> {
  const [eventRes, regRes] = await Promise.all([
    supabase.from("events").select(EVENT_SELECT).eq("id", eventId).single(),
    supabase
      .from("event_registrations")
      .select("*, event_attendance(*)")
      .eq("event_id", eventId)
      .order("registration_number", { ascending: true }),
  ]);
  if (eventRes.error) throw eventRes.error;
  if (regRes.error) throw regRes.error;
  return {
    event: eventRes.data as unknown as EventRow,
    registrations: (regRes.data ?? []) as unknown as EventRegistrationWithRelations[],
  };
}

/** Stops spreadsheet apps from executing user-typed text like "=HYPERLINK(...)". */
function safeCell(value: string | null | undefined): string {
  const v = value ?? "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const COLUMNS = [
  "Registration ID",
  "Full Name",
  "Phone",
  "Email",
  "Event",
  "Amount Paid",
  "Payment Reference",
  "Registration Date",
  "Registration Status",
  "Attendance Status",
  "Verified Date",
  "Verified By",
] as const;

function toRow(reg: EventRegistrationWithRelations) {
  return {
    "Registration ID": reg.registration_code,
    "Full Name": safeCell(reg.full_name_snapshot),
    Phone: safeCell(reg.phone_snapshot),
    Email: safeCell(reg.email_snapshot),
    Event: safeCell(reg.event_title_snapshot),
    "Amount Paid": Number(reg.amount_paid),
    "Payment Reference": safeCell(reg.payment_reference),
    "Registration Date": formatDateTime(reg.created_at),
    "Registration Status": reg.status,
    "Attendance Status": attendanceLabel(reg) === "—" ? "" : attendanceLabel(reg),
    "Verified Date": reg.verified_at ? formatDateTime(reg.verified_at) : "",
    "Verified By": safeCell(reg.verified_by_name),
  };
}

function stamp() {
  return format(new Date(), "yyyyMMdd-HHmm");
}

export async function exportEventRegistrationsToExcel(eventId: string) {
  const { event, registrations } = await fetchLatest(eventId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KED Finance";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Registrations");
  sheet.columns = [
    { header: COLUMNS[0], key: "Registration ID", width: 26 },
    { header: COLUMNS[1], key: "Full Name", width: 26 },
    { header: COLUMNS[2], key: "Phone", width: 18 },
    { header: COLUMNS[3], key: "Email", width: 30 },
    { header: COLUMNS[4], key: "Event", width: 28 },
    { header: COLUMNS[5], key: "Amount Paid", width: 16, style: { numFmt: "#,##0.00" } },
    { header: COLUMNS[6], key: "Payment Reference", width: 26 },
    { header: COLUMNS[7], key: "Registration Date", width: 22 },
    { header: COLUMNS[8], key: "Registration Status", width: 20 },
    { header: COLUMNS[9], key: "Attendance Status", width: 18 },
    { header: COLUMNS[10], key: "Verified Date", width: 22 },
    { header: COLUMNS[11], key: "Verified By", width: 24 },
  ];

  // Same header styling as the existing monthly report export.
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E0D12" } };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const reg of registrations) sheet.addRow(toRow(reg));

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${event.code}_registrations_${stamp()}.xlsx`,
  );
}

export async function exportEventRegistrationsToCSV(eventId: string) {
  const { event, registrations } = await fetchLatest(eventId);
  const csv = Papa.unparse({
    fields: [...COLUMNS],
    data: registrations.map((r) => {
      const row = toRow(r);
      return COLUMNS.map((c) => row[c]);
    }),
  });
  // BOM so Excel opens UTF-8 (names with accents, ₦) correctly.
  downloadBlob(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    `${event.code}_registrations_${stamp()}.csv`,
  );
}

export interface PopDownloadResult {
  total: number;
  added: number;
  failed: number;
}

/**
 * Builds a zip of every POP for the event:
 *   GELF-SUMMIT-2026/GELF-SUMMIT-2026-001-John-Doe/payment-proof.jpg
 * Files are pulled with short-lived signed URLs, so nothing is ever public.
 */
export async function downloadEventPops(
  eventId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<PopDownloadResult> {
  const { event, registrations } = await fetchLatest(eventId);
  if (registrations.length === 0) return { total: 0, added: 0, failed: 0 };

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const root = zip.folder(event.code)!;

  const { data: signed, error } = await supabase.storage
    .from("event-pops")
    .createSignedUrls(
      registrations.map((r) => r.pop_path),
      600,
    );
  if (error) throw error;

  const urlByPath = new Map<string, string>();
  for (const item of signed ?? []) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }

  let done = 0;
  let added = 0;
  let failed = 0;

  for (const reg of registrations) {
    try {
      const url = urlByPath.get(reg.pop_path);
      if (!url) throw new Error("no url");
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const ext = reg.pop_path.split(".").pop()?.toLowerCase() || "bin";
      const folder = root.folder(`${reg.registration_code}-${safeFileName(reg.full_name_snapshot)}`)!;
      folder.file(`payment-proof.${ext}`, blob);
      added++;
    } catch {
      failed++;
    } finally {
      done++;
      onProgress?.(done, registrations.length);
    }
  }

  if (added === 0) return { total: registrations.length, added, failed };

  const content = await zip.generateAsync({ type: "blob" });
  downloadBlob(content, `${event.code}_POPs_${stamp()}.zip`);
  return { total: registrations.length, added, failed };
}
