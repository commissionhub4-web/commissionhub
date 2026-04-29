export const COMMISSION_DEPARTMENTS = [
  "Communication",
  "Project Lead",
  "Development",
  "Development Support",
  "Night Shift",
  "Night Shift Support",
  "Sales",
  "Sales Support",
  "Upsell",
] as const;

export type CommissionDepartment = (typeof COMMISSION_DEPARTMENTS)[number];
