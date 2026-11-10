const {
  insert, find, findOne, query, updateWhere, findAndDelete, buildWhere, tx,
} = require('../db/helpers');
const { scopeFilter } = require('../middleware/scope');

// Default categories for new users
const DEFAULT_CATEGORIES = {
  expense: ['Food', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Shopping', 'Bills', 'Education', 'Personal', 'Other'],
  income: ['Salary', 'Freelance', 'Investment', 'Bonus', 'Gift', 'Other'],
};

// Add a new transaction
exports.addTransaction = async (req, res) => {
  try {
    const { type, amount, category, description, date } = req.body;

    if (!type || !amount || !category) {
      return res.status(400).json({ message: 'Type, amount, and category are required' });
    }

    const transaction = insert('transactions', {
      guestSession: req.dataScope.guestSession,
      userId: req.dataScope.user,
      type,
      amount,
      category,
      description: description || '',
      date: date ? new Date(date) : new Date(),
    });

    res.status(201).json({ message: 'Transaction added successfully', transaction });
  } catch (error) {
    res.status(500).json({ message: 'Error adding transaction', error: error.message });
  }
};

// Recent transactions across all months — used by the grant-access picker.
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = find('transactions', scopeFilter(req, 'userId'), {
      orderBy: '"date" DESC',
      limit: 500,
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

// Get transactions for a specific month
exports.getMonthlyTransactions = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const scope = buildWhere(scopeFilter(req, 'userId'));
    const transactions = query(
      'transactions',
      `SELECT * FROM "transactions" ${scope.sql || 'WHERE 1=1'} ` +
        'AND "date" >= ? AND "date" <= ? ORDER BY "date" DESC',
      [...scope.params, startDate.toISOString(), endDate.toISOString()]
    );

    // Calculate totals
    const totals = {
      income: 0,
      expense: 0,
      net: 0,
      byCategory: {},
    };

    transactions.forEach((transaction) => {
      if (transaction.type === 'income') {
        totals.income += transaction.amount;
      } else {
        totals.expense += transaction.amount;
      }

      if (!totals.byCategory[transaction.category]) {
        totals.byCategory[transaction.category] = { income: 0, expense: 0 };
      }

      if (transaction.type === 'income') {
        totals.byCategory[transaction.category].income += transaction.amount;
      } else {
        totals.byCategory[transaction.category].expense += transaction.amount;
      }
    });

    totals.net = totals.income - totals.expense;

    res.status(200).json({ transactions, totals });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

// Update a transaction
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, description, date } = req.body;

    const transaction = updateWhere(
      'transactions',
      { _id: id, ...scopeFilter(req, 'userId') },
      { type, amount, category, description, date: date ? new Date(date) : undefined }
    );

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.status(200).json({ message: 'Transaction updated successfully', transaction });
  } catch (error) {
    res.status(500).json({ message: 'Error updating transaction', error: error.message });
  }
};

// Delete a transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = findAndDelete('transactions', { _id: id, ...scopeFilter(req, 'userId') });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction', error: error.message });
  }
};

// Initialize default categories for user (or the current guest partition)
exports.initializeDefaultCategories = async (req, res) => {
  try {
    // Check if categories already exist in this partition
    const existingCategories = findOne('user_categories', scopeFilter(req, 'userId'));
    if (existingCategories) {
      return res.status(200).json({ message: 'Categories already initialized' });
    }

    // Create default categories
    const categoriesToCreate = [];
    DEFAULT_CATEGORIES.expense.forEach((name) => {
      categoriesToCreate.push({
        guestSession: req.dataScope.guestSession,
        userId: req.dataScope.user,
        name,
        type: 'expense',
        color: '#3B82F6',
      });
    });

    DEFAULT_CATEGORIES.income.forEach((name) => {
      categoriesToCreate.push({
        guestSession: req.dataScope.guestSession,
        userId: req.dataScope.user,
        name,
        type: 'income',
        color: '#10B981',
      });
    });

    tx(() => {
      categoriesToCreate.forEach((category) => insert('user_categories', category));
    });
    res.status(201).json({ message: 'Default categories initialized' });
  } catch (error) {
    res.status(500).json({ message: 'Error initializing categories', error: error.message });
  }
};

// Get all categories for a user
exports.getCategories = async (req, res) => {
  try {
    const { type } = req.query;

    const where = scopeFilter(req, 'userId');
    if (type) {
      where.type = type;
    }

    const categories = find('user_categories', where, { orderBy: '"name" ASC' });

    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

// Add a custom category
exports.addCategory = async (req, res) => {
  try {
    const { name, type, color } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    const category = insert('user_categories', {
      guestSession: req.dataScope.guestSession,
      userId: req.dataScope.user,
      name,
      type,
      color: color || '#3B82F6',
    });

    res.status(201).json({ message: 'Category added successfully', category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: 'Error adding category', error: error.message });
  }
};

// Delete a custom category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = findAndDelete('user_categories', { _id: id, ...scopeFilter(req, 'userId') });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
};

// Get default categories
exports.getDefaultCategories = (req, res) => {
  try {
    res.status(200).json({ categories: DEFAULT_CATEGORIES });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching default categories', error: error.message });
  }
};
