import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const AddTransactionModal = ({
  isOpen,
  onClose,
  onSubmit,
  editingTransaction,
  categories,
  defaultCategories,
}) => {
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [allCategories, setAllCategories] = useState([]);

  useEffect(() => {
    // Merge default and custom categories
    const customExpense = categories.filter(c => c.type === 'expense').map(c => c.name);
    const customIncome = categories.filter(c => c.type === 'income').map(c => c.name);

    const expenseCategories = [...new Set([...defaultCategories.expense, ...customExpense])];
    const incomeCategories = [...new Set([...defaultCategories.income, ...customIncome])];

    setAllCategories({
      expense: expenseCategories,
      income: incomeCategories,
    });
  }, [categories, defaultCategories]);

  useEffect(() => {
    if (editingTransaction) {
      setFormData({
        type: editingTransaction.type,
        amount: editingTransaction.amount,
        category: editingTransaction.category,
        description: editingTransaction.description,
        date: new Date(editingTransaction.date).toISOString().split('T')[0],
      });
    } else {
      setFormData({
        type: 'expense',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
    setShowNewCategory(false);
    setNewCategoryName('');
  }, [editingTransaction, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset category when type changes
      ...(name === 'type' && { category: '' })
    }));
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      setFormData(prev => ({
        ...prev,
        category: newCategoryName.trim()
      }));
      setShowNewCategory(false);
      setNewCategoryName('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit(formData);
    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  if (!isOpen) return null;

  const currentCategories = allCategories[formData.type] || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-secondary border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-lg transition"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Type
            </label>
            <div className="flex gap-3">
              {['income', 'expense'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type, category: '' }))}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg font-semibold transition border",
                    formData.type === type
                      ? type === 'income'
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-red-100 text-red-700 border-red-300"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Amount <span className="text-red-600">*</span>
            </label>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-2">₹</span>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="flex-1 bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Category <span className="text-red-600">*</span>
            </label>
            {!showNewCategory ? (
              <div className="flex gap-2">
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="flex-1 bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a category</option>
                  {currentCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg transition flex items-center gap-1"
                  title="Add custom category"
                >
                  <Plus size={18} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName('');
                  }}
                  className="bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add notes about this transaction..."
              rows="3"
              className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Date
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 rounded-lg transition"
            >
              {editingTransaction ? 'Update' : 'Add'} Transaction
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-background border border-border text-foreground font-semibold py-2 rounded-lg hover:bg-accent transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;
