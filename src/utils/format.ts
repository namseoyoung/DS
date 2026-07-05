const MONEY_UNIT = 10_000;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(Math.round(value * MONEY_UNIT));

export const formatWon = (amount: number) => `${formatNumber(amount)}원`;

export const formatValue = (value: number) => `${formatNumber(value)}원`;

export const formatPercent = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
