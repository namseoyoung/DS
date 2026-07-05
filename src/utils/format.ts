const MONEY_UNIT = 10_000;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(Math.round(value * MONEY_UNIT));

export const formatWon = (amount: number) => `${formatNumber(amount)}원`;

export const formatValue = (value: number) => `${formatNumber(value)}원`;

export const formatSignedWon = (amount: number) =>
  `${amount > 0 ? "+" : ""}${formatWon(amount)}`;

export const formatPercent = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${rounded > 0 ? "+" : ""}${formatted}%`;
};
