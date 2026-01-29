
export interface CSVProductRow {
  'Product Name': string;
  'Category'?: string;
  'Description'?: string;
  'Supplier'?: string;
  'Initial Stock'?: string;
  'Minimum Stock Level'?: string;
  'Cost Price'?: string;
  'Selling Price'?: string;
  'Creation Date'?: string;
}

export interface ValidationError {
  row: number;
  message: string;
}

export const parseCSV = (text: string) => {
  // Mock parser
  const rows = text.split('\n').slice(1); // Skip header
  const validRows: CSVProductRow[] = rows.map(row => {
      const cols = row.split(',');
      return {
          'Product Name': cols[0] || 'Unknown',
          'Category': cols[1],
          'Initial Stock': cols[4],
          'Cost Price': cols[6],
          'Selling Price': cols[7],
      }
  }).filter(r => r['Product Name']);

  return {
    validRows,
    errors: [],
    totalRows: rows.length
  };
};

export const generateErrorLogCSV = (errors: ValidationError[]) => {
  console.log('Generating error log', errors);
};

export const extractUniqueCategories = (rows: CSVProductRow[]) => {
  return [];
};
