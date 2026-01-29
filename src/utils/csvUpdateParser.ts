export interface CSVProductUpdateRow {
  'Product ID': string;
  'Product Name': string;
  'Category'?: string;
  'Description'?: string;
  'Supplier'?: string;
  'Minimum Stock Level'?: string;
  'Cost Price'?: string;
  'Selling Price'?: string;
}

export interface UpdateValidationError {
  row: number;
  message: string;
}

export const parseCSVUpdate = (text: string) => {
  return {
    validRows: [],
    errors: [],
    totalRows: 0
  };
};

export const generateUpdateErrorLogCSV = (errors: UpdateValidationError[]) => {
  console.log('Generating update error log', errors);
};

export const extractUpdateCategories = (rows: CSVProductUpdateRow[]) => {
  return [];
};
