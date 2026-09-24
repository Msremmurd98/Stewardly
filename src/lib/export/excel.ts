import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import { CATEGORY_LABELS, type AllocatableCategory } from "@/lib/allocation";
import { calculateUsagePercentage } from "@/lib/finance";
import type { ExportBundle } from "./shared";
import { goalsWithProgress, comparisonRows } from "./shared";
import { downloadBlob } from "./download";

const CATEGORIES: AllocatableCategory[] = ["tithe", "investment", "giving", "expense", "savings"];

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0E0D12" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
}

export async function exportMonthlyReportToExcel(bundle: ExportBundle) {
  const { account, transactions, currency, monthLabel } = bundle;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KED Finance";
  workbook.created = new Date();

  // ---------------- Summary ----------------
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Amount", key: "amount", width: 20 },
  ];
  styleHeaderRow(summary.getRow(1));
  summary.addRows([
    { metric: `${monthLabel} Financial Report`, amount: "" },
    { metric: "Opening Balance", amount: account.opening_balance },
    { metric: "Total Income", amount: account.total_income },
    { metric: "Total Outflows (actual)", amount: account.total_outflows },
    { metric: "Current Balance", amount: account.current_balance },
    { metric: "Closing Balance", amount: account.closing_balance ?? "" },
    { metric: "Carry Forward Amount", amount: account.carry_forward_amount },
    { metric: "Status", amount: account.status },
    { metric: "", amount: "" },
    { metric: "Currency", amount: currency },
  ]);

  // ---------------- Transactions ----------------
  const txnSheet = workbook.addWorksheet("Transactions");
  txnSheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "category", width: 16 },
    { header: "Amount", key: "amount", width: 16 },
    { header: "Narration", key: "narration", width: 36 },
  ];
  styleHeaderRow(txnSheet.getRow(1));
  for (const t of transactions) {
    txnSheet.addRow({
      date: format(parseISO(t.transaction_date), "yyyy-MM-dd"),
      category: CATEGORY_LABELS[t.category],
      amount: t.amount,
      narration: t.narration ?? "",
    });
  }

  // ---------------- Categories ----------------
  const catSheet = workbook.addWorksheet("Categories");
  catSheet.columns = [
    { header: "Category", key: "category", width: 16 },
    { header: "Allocated", key: "allocated", width: 16 },
    { header: "Used", key: "used", width: 16 },
    { header: "Remaining", key: "remaining", width: 16 },
    { header: "Usage %", key: "pct", width: 12 },
  ];
  styleHeaderRow(catSheet.getRow(1));
  for (const c of CATEGORIES) {
    const allocated = account[`${c}_allocated` as const];
    const used = account[`${c}_used` as const];
    catSheet.addRow({
      category: CATEGORY_LABELS[c],
      allocated,
      used,
      remaining: allocated - used,
      pct: `${Math.round(calculateUsagePercentage(used, allocated))}%`,
    });
  }

  // ---------------- Savings Goals ----------------
  const goalsSheet = workbook.addWorksheet("Savings Goals");
  goalsSheet.columns = [
    { header: "Goal", key: "name", width: 24 },
    { header: "Target", key: "target", width: 16 },
    { header: "Current", key: "current", width: 16 },
    { header: "Progress %", key: "progress", width: 14 },
    { header: "Target Date", key: "date", width: 16 },
    { header: "Status", key: "status", width: 12 },
  ];
  styleHeaderRow(goalsSheet.getRow(1));
  for (const g of goalsWithProgress(bundle.goals)) {
    goalsSheet.addRow({
      name: g.name,
      target: g.target_amount,
      current: g.current_amount,
      progress: `${Math.round(g.progress)}%`,
      date: g.target_date ?? "",
      status: g.status,
    });
  }

  // ---------------- Monthly Comparison ----------------
  const compareSheet = workbook.addWorksheet("Monthly Comparison");
  const rows = comparisonRows(bundle);
  if (rows) {
    const [prev, curr] = rows;
    compareSheet.columns = [
      { header: "Metric", key: "metric", width: 20 },
      { header: prev.label, key: "prev", width: 16 },
      { header: curr.label, key: "curr", width: 16 },
    ];
    styleHeaderRow(compareSheet.getRow(1));
    (
      [
        ["Income", "income"],
        ["Tithe", "tithe"],
        ["Investment", "investment"],
        ["Giving", "giving"],
        ["Expense", "expense"],
        ["Savings", "savings"],
        ["Opening Balance", "openingBalance"],
        ["Closing Balance", "closingBalance"],
      ] as const
    ).forEach(([label, key]) => {
      compareSheet.addRow({ metric: label, prev: prev[key], curr: curr[key] });
    });
  } else {
    compareSheet.addRow(["No prior month on record to compare against."]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `KED-Finance_${monthLabel.replace(/\s+/g, "-")}_report.xlsx`
  );
}
