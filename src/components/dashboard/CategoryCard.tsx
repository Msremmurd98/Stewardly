import { Link } from "react-router-dom";
import { CircularProgress } from "./CircularProgress";
import HatchedProgressBar, {getPct,getTone, TONE_BG } from "./HatchedProgressBar";
import { formatCurrency } from "@/lib/currency";
import { calculateUsagePercentage } from "@/lib/finance";
import { CATEGORY_LABELS, type AllocatableCategory } from "@/lib/allocation";
import type { AppCurrency } from "@/types/database";
import { cn } from "@/lib/utils";


const CARD_STYLES: Record<AllocatableCategory, string> = {
  tithe: "bg-category-tithe text-category-tithe-fg",
  investment: "bg-category-investment text-category-investment-fg",
  giving: "bg-category-giving text-category-giving-fg",
  expense: "bg-category-expense text-category-expense-fg",
  savings: "bg-category-savings text-category-savings-fg",
};

interface CategoryCardProps {
  category: AllocatableCategory;
  allocated: number;
  used: number;
  transactionCount: number;
  currency: AppCurrency;
}

export function CategoryCard({ category, allocated, used, transactionCount, currency }: CategoryCardProps) {
  const remaining = allocated - used;
  const pct = calculateUsagePercentage(used, allocated);
  const spentDot = TONE_BG[getTone(pct)];

  return (
    <Link
      to={`/category/${category}`}
      className={cn("block rounded-2xl p-5 transition-transform active:scale-[0.99]", CARD_STYLES[category])}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold">{CATEGORY_LABELS[category]}</h3>
          <p className="mt-0.5 text-xs opacity-70">{transactionCount} Transactions</p>
        </div>
        <CircularProgress percentage={pct} progressColor="currentColor" />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="opacity-70">Allocated</span>
        <span className="font-semibold">{formatCurrency(allocated, currency)}</span>
      </div>

      <div style={{paddingTop:6}}>
        <HatchedProgressBar value={pct} />
      </div>

     
<div className="mt-2 flex items-center justify-between text-xs opacity-80">
  <span className="flex items-center gap-1.5">
    <span className={`h-2.5 w-2.5 rounded-full border border-black ${spentDot}`} />
    SPENT {formatCurrency(used, currency)}
  </span>

 <span className="flex items-center gap-1.5">
  <span className={`h-2.5 w-2.5 rounded-full border border-black ${TONE_BG.empty}`} />
  REMAINING {formatCurrency(remaining, currency)}
</span>
</div>
    </Link>
  );
}
