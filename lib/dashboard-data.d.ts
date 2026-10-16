export type DashboardRecord = Record<string, unknown>;

export function asNumber(value: unknown): number | null;

export function normalizeClinicalTrialsGovStudy(
  study: unknown,
): DashboardRecord | null;

export function parseDatasetBody(
  body: unknown,
  key: string,
): { items: DashboardRecord[]; total: number };
