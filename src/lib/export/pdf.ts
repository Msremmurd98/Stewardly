import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { CATEGORY_LABELS, type AllocatableCategory } from "@/lib/allocation";
import { formatCurrency } from "@/lib/currency";
import { calculateUsagePercentage } from "@/lib/finance";
import type { ExportBundle } from "./shared";
import { goalsWithProgress } from "./shared";

const CATEGORIES: AllocatableCategory[] = ["tithe", "investment", "giving", "expense", "savings"];
const INK = "#0E0D12";
const MUTED = "#6B6875";

export function exportMonthlyReportToPDF(bundle: ExportBundle) {
  const { account, transactions, currency, monthLabel } = bundle;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  let cursorY = 50;

  // ---- Header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK);
  doc.text("KED Finance", marginX, cursorY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  doc.text(`${monthLabel} Financial Report`, marginX, (cursorY += 18));
  doc.text(`Generated ${format(new Date(), "d MMMM yyyy, HH:mm")}`, marginX, (cursorY += 14));
  cursorY += 16;

  // ---- Monthly summary table ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text("Monthly Summary", marginX, cursorY);
  cursorY += 6;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4 },
    head: [["Metric", "Amount"]],
    headStyles: { fillColor: [14, 13, 18], textColor: 255 },
    body: [
      ["Opening Balance", formatCurrency(account.opening_balance, currency, { showDecimals: true })],
      ["Income", formatCurrency(account.total_income, currency, { showDecimals: true })],
      ["Actual Outflows", formatCurrency(account.total_outflows, currency, { showDecimals: true })],
      ["Current Balance", formatCurrency(account.current_balance, currency, { showDecimals: true })],
      [
        "Closing Balance",
        account.closing_balance != null
          ? formatCurrency(account.closing_balance, currency, { showDecimals: true })
          : "Month still open",
      ],
      ["Carry Forward Amount", formatCurrency(account.carry_forward_amount, currency, { showDecimals: true })],
      ["Status", account.status],
    ],
  });
  // @ts-expect-error - jspdf-autotable augments doc with lastAutoTable at runtime
  cursorY = doc.lastAutoTable.finalY + 24;

  // ---- Allocation / category summary ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Category Summary", marginX, cursorY);
  cursorY += 6;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [14, 13, 18], textColor: 255 },
    head: [["Category", "Allocated", "Used", "Remaining", "Usage"]],
    body: CATEGORIES.map((c) => {
      const allocated = account[`${c}_allocated` as const];
      const used = account[`${c}_used` as const];
      return [
        CATEGORY_LABELS[c],
        formatCurrency(allocated, currency),
        formatCurrency(used, currency),
        formatCurrency(allocated - used, currency),
        `${Math.round(calculateUsagePercentage(used, allocated))}%`,
      ];
    }),
  });
  // @ts-expect-error - see above
  cursorY = doc.lastAutoTable.finalY + 24;

  // ---- Savings goals ----
  const goals = goalsWithProgress(bundle.goals);
  if (goals.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Savings Goals", marginX, cursorY);
    cursorY += 6;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [14, 13, 18], textColor: 255 },
      head: [["Goal", "Target", "Current", "Progress", "Target Date"]],
      body: goals.map((g) => [
        g.name,
        formatCurrency(g.target_amount, currency),
        formatCurrency(g.current_amount, currency),
        `${Math.round(g.progress)}%`,
        g.target_date ? format(parseISO(g.target_date), "MMM yyyy") : "—",
      ]),
    });
    // @ts-expect-error - see above
    cursorY = doc.lastAutoTable.finalY + 24;
  }

  // ---- Transactions (new page) ----
  doc.addPage();
  cursorY = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text("Transactions", marginX, cursorY);
  cursorY += 6;

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [14, 13, 18], textColor: 255 },
    head: [["Date", "Category", "Amount", "Narration"]],
    body: transactions.map((t) => [
      format(parseISO(t.transaction_date), "d MMM yyyy"),
      CATEGORY_LABELS[t.category],
      formatCurrency(t.amount, currency, { showDecimals: true }),
      t.narration ?? "",
    ]),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1 && data.cell.raw === "Income") {
        data.cell.styles.textColor = [63, 145, 66];
      }
    },
  });

  // ---- Footer page numbers ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(`KED Finance — ${monthLabel}`, marginX, doc.internal.pageSize.height - 24);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - marginX - 60, doc.internal.pageSize.height - 24);
  }

  doc.save(`KED-Finance_${monthLabel.replace(/\s+/g, "-")}_report.pdf`);
}
