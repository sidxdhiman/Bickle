import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight,
  Edit, Trash2, Eye
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AddTransactionModal from '../components/AddTransactionModal';
import TransactionHistoryModal from '../components/TransactionHistoryModal';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Money = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, net: 0, byCategory: {} });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [categories, setCategories] = useState([]);
  const [defaultCategories, setDefaultCategories] = useState({ income: [], expense: [] });

  // Fetch monthly transactions
  useEffect(() => {
    initializeCategories();
  }, []);

  useEffect(() => {
    fetchMonthlyData();
    fetchCategories();
    fetchDefaultCategories();
  }, [currentMonth]);

  const initializeCategories = async () => {
    try {
      // Initialize default categories for first-time users
      await axios.post('/money/categories/init');
    } catch (error) {
      // Categories might already be initialized, ignore error
      console.log('Categories initialization:', error.message);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      setLoading(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      const res = await axios.get('/money/transactions', {
        params: { year, month }
      });

      setTransactions(res.data.transactions);
      setTotals(res.data.totals);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/money/categories');
      setCategories(res.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchDefaultCategories = async () => {
    try {
      const res = await axios.get('/money/categories/default');
      const categories = res.data.categories;
      setDefaultCategories({
        income: categories.income,
        expense: categories.expense
      });
    } catch (error) {
      console.error('Error fetching default categories:', error);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleAddTransaction = async (formData) => {
    try {
      if (editingTransaction) {
        await axios.put(`/money/transactions/${editingTransaction._id}`, formData);
      } else {
        await axios.post('/money/transactions', formData);
      }
      await fetchMonthlyData();
      setShowAddModal(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error('Error adding/updating transaction:', error);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await axios.delete(`/money/transactions/${id}`);
        await fetchMonthlyData();
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setShowAddModal(true);
  };

  const openHistory = () => {
    setShowHistoryModal(true);
  };

  const monthYear = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Money Tracker</h1>
          <p className="text-muted-foreground">Track your income and expenses</p>
        </div>
        <button
          onClick={() => {
            setEditingTransaction(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition"
        >
          <Plus size={20} />
          Add Transaction
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary border border-border">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-accent rounded-lg transition"
        >
          <ChevronLeft size={20} className="text-muted-foreground" />
        </button>
        <h2 className="text-xl font-semibold">{monthYear}</h2>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-accent rounded-lg transition"
        >
          <ChevronRight size={20} className="text-muted-foreground" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Card */}
        <div className="p-6 rounded-2xl bg-secondary border-2 border-green-500/30 hover:border-green-500/50 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-green-600">Total Income</span>
            <TrendingUp size={20} className="text-green-600" />
          </div>
          <h3 className="text-2xl font-bold mb-2">₹{totals.income.toFixed(2)}</h3>
          <button
            onClick={openHistory}
            className="text-xs text-green-600 hover:text-green-700 transition"
          >
            View Details →
          </button>
        </div>

        {/* Expense Card */}
        <div className="p-6 rounded-2xl bg-secondary border-2 border-red-500/30 hover:border-red-500/50 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-red-600">Total Expense</span>
            <TrendingDown size={20} className="text-red-600" />
          </div>
          <h3 className="text-2xl font-bold mb-2">₹{totals.expense.toFixed(2)}</h3>
          <button
            onClick={openHistory}
            className="text-xs text-red-600 hover:text-red-700 transition"
          >
            View Details →
          </button>
        </div>

        {/* Net Balance Card */}
        <div className={cn(
          "p-6 rounded-2xl bg-secondary transition",
          totals.net >= 0
            ? "border-2 border-blue-500/30 hover:border-blue-500/50"
            : "border-2 border-orange-500/30 hover:border-orange-500/50"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn("text-sm font-semibold", totals.net >= 0 ? "text-blue-600" : "text-orange-600")}>
              Net Balance
            </span>
            <DollarSign size={20} className={totals.net >= 0 ? "text-blue-600" : "text-orange-600"} />
          </div>
          <h3 className="text-2xl font-bold mb-2">₹{totals.net.toFixed(2)}</h3>
          <button
            onClick={openHistory}
            className={cn(
              "text-xs transition",
              totals.net >= 0 ? "text-blue-600 hover:text-blue-700" : "text-orange-600 hover:text-orange-700"
            )}
          >
            View Details →
          </button>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-2xl bg-secondary border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
        {Object.keys(totals.byCategory).length === 0 ? (
          <p className="text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(totals.byCategory).map(([category, amounts]) => (
              <div key={category} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:border-primary/50 transition cursor-pointer" onClick={openHistory}>
                <div>
                  <p className="font-semibold">{category}</p>
                  <p className="text-muted-foreground text-sm">
                    Income: ₹{amounts.income.toFixed(2)} | Expense: ₹{amounts.expense.toFixed(2)}
                  </p>
                </div>
                <Eye size={18} className="text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions Preview */}
      <div className="rounded-2xl bg-secondary border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
          <button
            onClick={openHistory}
            className="text-primary hover:text-primary/80 text-sm transition"
          >
            View All →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-background rounded animate-pulse"></div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map(transaction => (
              <div key={transaction._id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:border-primary/50 transition group">
                <div className="flex items-center gap-3 flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    transaction.type === 'income' ? "bg-green-100" : "bg-red-100"
                  )}>
                    {transaction.type === 'income' ? (
                      <TrendingUp size={18} className="text-green-600" />
                    ) : (
                      <TrendingDown size={18} className="text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{transaction.category}</p>
                    <p className="text-muted-foreground text-sm">{transaction.description || 'No description'}</p>
                  </div>
                </div>
                <div className="text-right mr-3">
                  <p className={cn(
                    "font-bold text-lg",
                    transaction.type === 'income' ? "text-green-600" : "text-red-600"
                  )}>
                    {transaction.type === 'income' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground text-xs">{new Date(transaction.date).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleEditTransaction(transaction)}
                    className="p-1 hover:bg-accent rounded transition"
                  >
                    <Edit size={16} className="text-primary" />
                  </button>
                  <button
                    onClick={() => handleDeleteTransaction(transaction._id)}
                    className="p-1 hover:bg-accent rounded transition"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddTransactionModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(null);
          }}
          onSubmit={handleAddTransaction}
          editingTransaction={editingTransaction}
          categories={categories}
          defaultCategories={defaultCategories}
        />
      )}

      {showHistoryModal && (
        <TransactionHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          month={currentMonth.getMonth() + 1}
          year={currentMonth.getFullYear()}
          onEdit={handleEditTransaction}
          onDelete={handleDeleteTransaction}
          onAddNew={() => {
            setEditingTransaction(null);
            setShowAddModal(true);
          }}
        />
      )}
    </div>
  );
};

export default Money;
