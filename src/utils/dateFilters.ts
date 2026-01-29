export const getDateRangeFromFilter = (filter: string) => {
    const now = new Date();
    if (filter === 'today') return { from: new Date(now.setHours(0,0,0,0)), to: new Date(now.setHours(23,59,59,999)) };
    if (filter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: new Date(yesterday.setHours(0,0,0,0)), to: new Date(yesterday.setHours(23,59,59,999)) };
    }
    if (filter === 'this-month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    return { from: new Date(0), to: now };
}
