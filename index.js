import express from 'express';
import cors from 'cors'; // Import the cors package
import swaggerUi from 'swagger-ui-express';
import { swaggerDocs } from './app/swaggerConfig.js';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all origins
// CORS setup
const corsOptions = {
  origin: '*', // Allow all origins
  methods: 'GET, POST, PUT, DELETE', // Allow these methods
  allowedHeaders: 'Content-Type, Authorization', // Allow these headers
};

app.use(cors(corsOptions));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Import routes
import stockRoutes from './app/routes/stockRoutes.js';
import selectedStock from './app/routes/selectedStock.js';
import newsRoutes from './app/routes/newsRoutes.js';
import extractRoutes from './app/routes/extractRoutes.js';
import userRoutes from './app/routes/userRoutes.js';
import stockList from './app/routes/stockList.js';
// Use routes
app.use('/stock-list', stockList);

app.use('/all_stock', stockRoutes);
app.use('/stock', selectedStock);
app.use('/news', newsRoutes);
app.use('/extract', extractRoutes);
app.use('/auth', userRoutes);

// Define the cron job
cron.schedule('* * * * *', async () => {
  console.log('Running cron job for StockSelection');

  try {
    const selectedStocks = await prisma.stockSelection.findMany({
      where: { selected: true },
      include: {
        stock: true,
      },
    });

    const selectedStockNames = selectedStocks.map((stock) => stock.stock?.name);
    console.log('Selected Stock Names:', selectedStockNames);

    const extractRequests = selectedStockNames.map(async (name) => {
      try {
        const extractResponse = await axios.get(
          `${
            process.env.NGROK_URL || `http://localhost:${PORT}`
          }/news?stock_name=${name}`
        );
        console.log(
          `Data extracted successfully for ${name}:`,
          extractResponse.data
        );
      } catch (error) {
        console.error(`Error extracting data for ${name}:`, error.message);
      }
    });

    await Promise.all(extractRequests);

    const selectedStockIds = selectedStocks.map((stock) => stock.stockId);
    console.log('Selected Stock IDs:', selectedStockIds);

    const selectedNews = await prisma.news.findMany({
      where: { stockId: { in: selectedStockIds }, content: '' },
      include: {
        stock: true,
      },
    });

    console.log('Selected News:', selectedNews);

    const newsExtractionRequests = selectedNews.map(async (news) => {
      try {
        const extractResponse = await axios.post(
          `${process.env.NGROK_URL || `http://localhost:${PORT}`}/extract`,
          { url: news.url, stock_name: news.stock.name }
        );
        console.log(
          `Data extracted successfully for ${news.stock.name}:`,
          extractResponse.data
        );
      } catch (error) {
        console.error(
          `Error extracting news for ${news.stock.name}:`,
          error.message
        );
      }
    });

    await Promise.all(newsExtractionRequests);
  } catch (error) {
    console.error('Error occurred during the cron job:', error.message);
  }
});

const host = '0.0.0.0'; // Listen on all network interfaces for ngrok
app.listen(PORT, host, () => {
  console.log(`Server is running on http://localhost:5000`);
});
