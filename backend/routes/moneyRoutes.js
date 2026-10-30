const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const moneyController = require('../controllers/moneyController');

// All routes require authentication
router.use(protect);

// Transaction routes
router.post('/transactions', moneyController.addTransaction);
router.get('/transactions', moneyController.getMonthlyTransactions);
// Recent transactions across months (used by the grant-access item picker).
router.get('/transactions/all', moneyController.getAllTransactions);
router.put('/transactions/:id', moneyController.updateTransaction);
router.delete('/transactions/:id', moneyController.deleteTransaction);

// Category routes
router.post('/categories/init', moneyController.initializeDefaultCategories);
router.get('/categories', moneyController.getCategories);
router.post('/categories', moneyController.addCategory);
router.delete('/categories/:id', moneyController.deleteCategory);
router.get('/categories/default', moneyController.getDefaultCategories);

module.exports = router;
