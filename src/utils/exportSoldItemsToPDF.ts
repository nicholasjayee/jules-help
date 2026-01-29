
export const exportSoldItemsToPDF = (
  soldItems: any[],
  periodLabel: string,
  currency: string,
  showCostData: boolean,
  dateRange: any,
  businessDetails: any
) => {
  console.log('Exporting to PDF:', soldItems, periodLabel, currency, showCostData, dateRange, businessDetails);
};
