export const usePagination = (args: { items: any[], itemsPerPage: number }) => {
  return {
    currentPage: 1,
    totalPages: 1,
    startIndex: 0,
    endIndex: 0,
    paginatedItems: args.items,
    goToPage: (page: number) => {},
    nextPage: () => {},
    previousPage: () => {},
    setCurrentPage: (page: number) => {},
  };
};
