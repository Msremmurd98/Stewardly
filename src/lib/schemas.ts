import { z } from "zod";

export const incomeFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Enter an amount")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Amount must be a positive number"),
  date: z.string().min(1, "Select a date"),
  narration: z.string().max(280, "Keep it under 280 characters").optional(),
});
export type IncomeFormValues = z.infer<typeof incomeFormSchema>;

export const categoryFormSchema = z.object({
  category: z.enum(["tithe", "investment", "giving", "expense", "savings"]),
  amount: z
    .string()
    .min(1, "Enter an amount")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Amount must be a positive number"),
  date: z.string().min(1, "Select a date"),
  narration: z.string().max(280, "Keep it under 280 characters").optional(),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
