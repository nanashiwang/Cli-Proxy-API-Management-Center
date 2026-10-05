import type { CodexCreditBalance } from '@/types';

/** Preserve upstream decimals as text, without inferring balances from reset cards. */
export function parseCodexCredits(value: unknown): CodexCreditBalance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const amount = raw.balance;
  const text =
    typeof amount === 'string'
      ? amount.trim()
      : typeof amount === 'number' &&
          Number.isFinite(amount) &&
          Math.abs(amount) <= Number.MAX_SAFE_INTEGER
        ? String(amount)
        : '';
  const balance = text.length <= 128 && /^-?\d+(?:\.\d+)?$/.test(text) ? text : null;
  const hasCredits = raw.has_credits ?? raw.hasCredits;
  const result = {
    balance,
    unlimited: typeof raw.unlimited === 'boolean' ? raw.unlimited : null,
    hasCredits: typeof hasCredits === 'boolean' ? hasCredits : null,
  };
  return Object.values(result).some((fact) => fact !== null) ? result : null;
}

export function formatCodexCreditBalance(balance: string, locale?: string): string {
  const [integer, fraction] = balance.split('.');
  const negative = integer.startsWith('-');
  const grouped = new Intl.NumberFormat(locale).format(
    BigInt(negative ? integer.slice(1) : integer)
  );
  const decimal =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')
      ?.value || '.';
  return `${negative ? '−' : ''}${grouped}${fraction === undefined ? '' : decimal + fraction}`;
}
