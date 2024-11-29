const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./swaggerConfig.js');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const app = express();
const PORT = 5000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Import routes
const stockRoutes = require('./routes/stockRoutes.js');
const selectedStock = require('./routes/selectedStock.js');
const newsRoutes = require('./routes/newsRoutes.js');
const extractRoutes = require('./routes/extractRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
// const openAiRoutes = require('./routes/openAiRoutes.js');

// Use routes
app.use('/all_stock', stockRoutes);
app.use('/stock', selectedStock);
// app.use('/openai', openAiRoutes);
app.use('/news', newsRoutes);
app.use('/extract', extractRoutes);
app.use('/auth', userRoutes);

// Define the cron job
cron.schedule('* * * * *', async () => {
  console.log('Running cron job for StockSelection');

  try {
    // Step 1: Fetch all selected stocks by users
    const selectedStocks = await prisma.stockSelection.findMany({
      where: { selected: true },
      include: {
        stock: true,
      },
    });

    // Step 2: Extract stock names
    const selectedStockNames = selectedStocks.map((stock) => stock.stock?.name);
    console.log('Selected Stock Names:', selectedStockNames);

    // Step 3: Send news URLs to the extraction API (concurrently)
    const extractRequests = selectedStockNames.map(async (name) => {
      try {
        const extractResponse = await axios.get(
          `http://localhost:${PORT}/news?stock_name=${name}`
        );
        console.log(
          `Data extracted successfully for ${name}:`,
          extractResponse.data
        );
      } catch (error) {
        console.error(`Error extracting data for ${name}:`, error);
      }
    });

    // Wait for all extraction requests to complete
    await Promise.all(extractRequests);

    // Step 4: Fetch news related to selected stocks
    const selectedStockIds = selectedStocks.map((stock) => stock.stockId);
    console.log('Selected Stock IDs:', selectedStockIds);

    const selectedNews = await prisma.news.findMany({
      where: { stockId: { in: selectedStockIds }, content: '' },
      include: {
        stock: true,
      },
    });

    console.log('Selected News:', selectedNews);

    // Step 5: Send news URLs to the extraction API (concurrently)
    const newsExtractionRequests = selectedNews.map(async (news) => {
      try {
        const extractResponse = await axios.post(
          `http://localhost:${PORT}/extract`,
          {
            url: news.url,
            stock_name: news.stock.name,
          }
        );
        console.log(
          `Data extracted successfully for ${news.stock.name}:`,
          extractResponse.data
        );
      } catch (error) {
        // console.error(`Error extracting data for ${news.stock.name}:`, error);
      }
    });

    // Wait for all news extraction requests to complete
    await Promise.all(newsExtractionRequests);
  } catch (error) {
    // console.error('Error occurred during the cron job:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
