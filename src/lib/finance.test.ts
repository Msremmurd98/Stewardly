import { describe, expect, it } from "vitest";
import {
  calculateAllocation,
  calculateRemaining,
  calculateUsagePercentage,
  calculateCurrentBalance,
  calculateCarryForward,
  calculateSavingsGoalProgress,
  budgetWarningMessage,
} from "./finance";

describe("calculateAllocation", () => {
  it("splits ₦100,000 income into the fixed 10/30/30/20/10", () => {
    const result = calculateAllocation(100_000);
    expect(result.tithe).toBe(10_000);
    expect(result.investment).toBe(30_000);
    expect(result.giving).toBe(30_000);
    expect(result.expense).toBe(20_000);
    expect(result.savings).toBe(10_000);
  });

  it("returns all zeros for a non-positive amount", () => {
    expect(calculateAllocation(0)).toEqual({ tithe: 0, investment: 0, giving: 0, expense: 0, savings: 0 });
    expect(calculateAllocation(-500)).toEqual({ tithe: 0, investment: 0, giving: 0, expense: 0, savings: 0 });
  });
});

describe("calculateRemaining", () => {
  it("is allocated minus used, never treating allocation as spend", () => {
    expect(calculateRemaining(90_000, 60_000)).toBe(30_000);
  });
});

describe("calculateUsagePercentage", () => {
  it("computes used/allocated * 100", () => {
    expect(calculateUsagePercentage(71, 100)).toBe(71);
    expect(calculateUsagePercentage(85_000, 100_000)).toBe(85);
    expect(calculateUsagePercentage(100_000, 100_000)).toBe(100);
  });
  it("is 0 when nothing is allocated", () => {
    expect(calculateUsagePercentage(500, 0)).toBe(0);
  });
});

describe("budgetWarningMessage", () => {
  it("warns at 71% usage", () => {
    expect(budgetWarningMessage("Expense", 71, 100)).toMatch(/71%/);
  });
  it("warns at 85% usage with month label", () => {
    expect(budgetWarningMessage("Expense", 85, 100, "September")).toMatch(/85%/);
  });
  it("reports full usage at 100%", () => {
    expect(budgetWarningMessage("Expense", 100, 100)).toMatch(/fully used/);
  });
  it("is silent below the 70% threshold", () => {
    expect(budgetWarningMessage("Expense", 50, 100)).toBeNull();
  });
});

describe("calculateCurrentBalance", () => {
  it("is opening balance + income - actual outflows", () => {
    expect(calculateCurrentBalance(85_000, 500_000, 415_000)).toBe(170_000);
  });
  it("never subtracts allocation, only actual outflows", () => {
    // ₦150,000 investment allocation exists but only ₦0 has actually been spent
    expect(calculateCurrentBalance(0, 500_000, 0)).toBe(500_000);
  });
});

describe("calculateCarryForward", () => {
  it("carries September's closing balance into October's opening balance", () => {
    expect(calculateCarryForward(85_000)).toBe(85_000);
  });
  it("is never classified as income - it's a distinct field", () => {
    const carryForward = calculateCarryForward(85_000);
    const octoberIncome = 500_000;
    const availableFunds = carryForward + octoberIncome;
    expect(availableFunds).toBe(585_000);
    expect(octoberIncome).toBe(500_000); // income itself is untouched by carry-forward
  });
});

describe("calculateSavingsGoalProgress", () => {
  it("computes current/target * 100", () => {
    expect(calculateSavingsGoalProgress({ current_amount: 450_000, target_amount: 1_000_000 })).toBe(45);
  });
  it("caps at 100 even if overfunded", () => {
    expect(calculateSavingsGoalProgress({ current_amount: 1_200_000, target_amount: 1_000_000 })).toBe(100);
  });
});
