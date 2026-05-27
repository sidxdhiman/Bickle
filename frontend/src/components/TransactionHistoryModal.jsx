import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, TrendingUp, TrendingDown, Edit, Trash2, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const TransactionHistoryModal = ({
  isOpen,
  onClose,
  month,
  year,
  onEdit,
  onDelete,
  onAddNew,
}) => {
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, net: 0, byCategory: {} });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  useEffect(() => {
    if (isOpen) {
      fetchTransactionHistory();
    }
  }, [isOpen, month, year]);

  const fetchTransactionHistory = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/money/transactions', {
        params: { year, month }
      });
      setTransactions(res.data.transactions);
      setTotals(res.data.totals);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions
    .filter(t => filterType === 'all' || t.type === filterType)
    .filter(t => filterCategory === 'all' || t.category === filterCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date) - new Date(a.date);
        case 'date-asc':
          return new Date(a.date) - new Date(b.date);
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

  const categories = ['all', ...new Set(transactions.map(t => t.category))];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-secondary border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold">Transaction History</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-lg transition"
          >
            <X size={24} className="text-muted-foreground" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b border-border">
          <div className="bg-background border-2 border-green-500/30 p-4 rounded-lg">
            <p className="text-green-600 text-sm">Total Income</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₹{totals.income.toFixed(2)}</p>
          </div>
          <div className="bg-background border-2 border-red-500/30 p-4 rounded-lg">
            <p className="text-red-600 text-sm">Total Expense</p>
            <p className="text-2xl font-bold text-red-600 mt-1">₹{totals.expense.toFixed(2)}</p>
          </div>
          <div className={cn(
            "bg-background p-4 rounded-lg border-2",
            totals.net >= 0
              ? "border-blue-500/30"
              : "border-orange-500/30"
          )}>
            <p className={cn("text-sm", totals.net >= 0 ? "text-blue-600" : "text-orange-600")}>
              Net Balance
            </p>
            <p className={cn("text-2xl font-bold mt-1", totals.net >= 0 ? "text-blue-600" : "text-orange-600")}>
              ₹{totals.net.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="p-6 border-b border-border space-y-3">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-2">
                <Filter size={16} className="inline mr-1" />
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Transactions</option>
                <option value="income">Income Only</option>
                <option value="expense">Expense Only</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-2">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="date-desc">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="amount-desc">Amount (Highest First)</option>
                <option value="amount-asc">Amount (Lowest First)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-background rounded animate-pulse"></div>
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32">
              <p className="text-muted-foreground mb-4">No transactions found</p>
              <button
                onClick={onAddNew}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition"
              >
                Add New Transaction
              </button>
            </div>
          ) : (
            filteredTransactions.map(transaction => (
              <div
                key={transaction._id}
                className="bg-background hover:bg-accent p-4 rounded-lg transition group flex items-center justify-between border border-border"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                    transaction.type === 'income' ? "bg-green-100" : "bg-red-100"
                  )}>
                    {transaction.type === 'income' ? (
                      <TrendingUp size={20} className="text-green-600" />
                    ) : (
                      <TrendingDown size={20} className="text-red-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{transaction.category}</p>
                    {transaction.description && (
                      <p className="text-muted-foreground text-sm truncate">{transaction.description}</p>
                    )}
                    <p className="text-muted-foreground text-xs mt-1">
                      {new Date(transaction.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="text-right mr-4">
                  <p className={cn(
                    "font-bold text-lg",
                    transaction.type === 'income' ? "text-green-600" : "text-red-600"
                  )}>
                    {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                  </p>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      onEdit(transaction);
                      onClose();
                    }}
                    className="p-2 hover:bg-background rounded transition"
                    title="Edit"
                  >
                    <Edit size={18} className="text-primary" />
                  </button>
                  <button
                    onClick={() => onDelete(transaction._id)}
                    className="p-2 hover:bg-background rounded transition"
                    title="Delete"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Category Breakdown */}
        {filteredTransactions.length > 0 && (
          <div className="p-6 border-t border-border">
            <h3 className="text-lg font-bold mb-4">Category Breakdown</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(totals.byCategory).map(([category, amounts]) => (
                <div key={category} className="bg-background border border-border p-3 rounded-lg">
                  <p className="font-semibold">{category}</p>
                  <div className="text-sm text-muted-foreground mt-1">
                    <p>Income: ₹{amounts.income.toFixed(2)}</p>
                    <p>Expense: ₹{amounts.expense.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistoryModal;
