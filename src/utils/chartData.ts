import type { Company, PricePoint } from "../types";

export function normalizePriceHistory(data: PricePoint[], currentValue: number): PricePoint[] {
  if (data.length >= 2) return data;

  const first = data[0] ?? {
    tick: 0,
    year: 1,
    value: currentValue,
    createdAt: new Date().toISOString(),
  };

  return [
    first,
    {
      ...first,
      tick: first.tick + 1,
      value: currentValue,
    },
  ];
}

export function buildMarketChartData(companies: Company[]) {
  if (companies.length === 0) return [];

  const histories = companies.map((company) =>
    normalizePriceHistory(company.history, company.currentValue),
  );
  const rowCount = Math.max(...histories.map((history) => history.length));

  return Array.from({ length: rowCount }, (_, index) => {
    const basePoint = histories[0][index] ?? histories[0][histories[0].length - 1];
    const row: Record<string, string | number> = {
      label: `${basePoint.year}년차-${basePoint.tick}`,
    };

    companies.forEach((company, companyIndex) => {
      const history = histories[companyIndex];
      row[company.name] = history[index]?.value ?? company.currentValue;
    });

    return row;
  });
}
