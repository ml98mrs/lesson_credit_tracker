import { CreditLotSource } from "./credit-lot-types";

export const SOURCE_COLORS: Record<CreditLotSource, string> = {
  invoice:   "bg-blue-100 text-blue-800",
  award:     "bg-emerald-100 text-emerald-800",
  adjustment:"bg-gray-100 text-gray-700",
  overdraft: "bg-rose-100 text-rose-800",
};
