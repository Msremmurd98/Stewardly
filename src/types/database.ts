export type TransactionCategory =
  | "income"
  | "tithe"
  | "investment"
  | "giving"
  | "expense"
  | "savings";

export type MonthStatus = "OPEN" | "CLOSED";
export type AppCurrency = "NGN" | "USD" | "EUR" | "GBP";
export type GoalStatus = "active" | "completed" | "archived";
export type NotificationType =
  | "salary_due"
  | "budget_warning"
  | "goal_progress"
  | "month_closing"
  | "system";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  currency: AppCurrency;
  created_at: string;
  updated_at: string;
}

export interface MonthlyAccount {
  id: string;
  user_id: string;
  month: number;
  year: number;

  opening_balance: number;
  total_income: number;
  total_outflows: number;
  current_balance: number;
  closing_balance: number | null;
  carry_forward_amount: number;

  status: MonthStatus;

  tithe_percentage: number;
  investment_percentage: number;
  giving_percentage: number;
  expense_percentage: number;
  savings_percentage: number;

  tithe_allocated: number;
  investment_allocated: number;
  giving_allocated: number;
  expense_allocated: number;
  savings_allocated: number;

  tithe_used: number;
  investment_used: number;
  giving_used: number;
  expense_used: number;
  savings_used: number;

  created_at: string;
  updated_at: string;
  closed_at: string | null;
  reopened_at: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  monthly_account_id: string;
  category: TransactionCategory;
  amount: number;
  transaction_date: string; // yyyy-MM-dd
  narration: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  scheduled_for: string | null;
  created_at: string;
}

export interface ExpectedIncome {
  id: string;
  user_id: string;
  name: string;
  expected_amount: number;
  expected_date: string | null;
  frequency: "weekly" | "biweekly" | "monthly" | "custom";
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
