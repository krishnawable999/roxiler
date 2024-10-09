const express = require('express');
const Transaction = require('../models/Transaction');
const axios = require('axios');
const router = express.Router();

// Initialize database with API data
router.get('/initialize', async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const transactions = response.data;
    await Transaction.deleteMany({});
    await Transaction.insertMany(transactions);
    res.status(200).send('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    res.status(500).send('Error initializing database');
  }
});

// Route for listing transactions with search and pagination
// Route for listing transactions with search and pagination
router.get('/transactions', async (req, res) => {
  const { page = 1, perPage = 10, search = '', month } = req.query;

  // Map month names to their corresponding numbers
  const monthMap = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
  };

  const monthNumber = monthMap[month];

  if (!monthNumber) {
    return res.status(400).send('Invalid month');
  }

  try {
    // Filter transactions by the selected month
    const searchQuery = {
      $and: [
        { title: { $regex: search, $options: 'i' } },
        { $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] } } // Correct month matching
      ]
    };

    const transactions = await Transaction.find(searchQuery)
      .skip((page - 1) * perPage)
      .limit(Number(perPage));

    const total = await Transaction.countDocuments(searchQuery);

    res.json({ transactions, totalPages: Math.ceil(total / perPage) });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).send('Error fetching transactions');
  }
});


// Route for fetching statistics (total sales, sold items, unsold items)
router.get('/statistics', async (req, res) => {
  const { month } = req.query;

  const monthMap = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
  };

  const monthNumber = monthMap[month];

  if (!monthNumber) {
    return res.status(400).send('Invalid month');
  }

  try {
    // Aggregation to calculate total sales, sold items, and unsold items
    const totalSales = await Transaction.aggregate([
      {
        $match: {
          $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$price' },
          soldItems: { $sum: { $cond: ['$sold', 1, 0] } }
        }
      }
    ]);

    const totalUnsold = await Transaction.countDocuments({
      $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },
      sold: false
    });

    res.json({
      totalSales: totalSales[0]?.total || 0,
      soldItems: totalSales[0]?.soldItems || 0,
      unsoldItems: totalUnsold
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).send('Error fetching statistics');
  }
});




// Route for fetching bar chart data (price ranges)
// Route for fetching bar chart data (price ranges)
router.get('/bar-chart', async (req, res) => {
    const { month } = req.query;
  
    // Convert month name to month number (e.g., March -> 3)
    const monthMap = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
    };
    const monthNumber = monthMap[month];
  
    if (!monthNumber) {
      return res.status(400).send('Invalid month');
    }
  
    const priceRanges = [
      { range: '0-100', min: 0, max: 100 },
      { range: '101-200', min: 101, max: 200 },
      { range: '201-300', min: 201, max: 300 },
      { range: '301-400', min: 301, max: 400 },
      { range: '401-500', min: 401, max: 500 },
      { range: '501-600', min: 501, max: 600 },
      { range: '601-700', min: 601, max: 700 },
      { range: '701-800', min: 701, max: 800 },
      { range: '801-900', min: 801, max: 900 },
      { range: '901-above', min: 901 }
    ];
  
    try {
      const data = await Promise.all(
        priceRanges.map(async (range) => {
          const count = await Transaction.countDocuments({
            $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },  // Extract month from dateOfSale
            price: { $gte: range.min, ...(range.max && { $lte: range.max }) }
          });
          return { range: range.range, count };
        })
      );
  
      res.json(data);
    } catch (error) {
      console.error('Error fetching bar chart data:', error);
      res.status(500).send('Error fetching bar chart data');
    }
  });
  

// Route for fetching pie chart data (categories)
// Route for fetching pie chart data (categories)
router.get('/pie-chart', async (req, res) => {
    const { month } = req.query;
  
    // Convert month name to month number (e.g., March -> 3)
    const monthMap = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
    };
    const monthNumber = monthMap[month];
  
    if (!monthNumber) {
      return res.status(400).send('Invalid month');
    }
  
    try {
      const data = await Transaction.aggregate([
        {
          $match: {
            $expr: { $eq: [{ $month: '$dateOfSale' }, monthNumber] },  // Extract month from dateOfSale
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            count: 1
          }
        }
      ]);
  
      res.json(data);
    } catch (error) {
      console.error('Error fetching pie chart data:', error);
      res.status(500).send('Error fetching pie chart data');
    }
  });
  

module.exports = router;
