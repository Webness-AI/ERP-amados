export function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function normalizeOptionalString(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toDateOrNull(value?: string): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}