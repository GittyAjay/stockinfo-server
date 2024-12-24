import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocs } from './app/swaggerConfig.js';
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
// import nodemailer from 'nodemailer';
// Import routes before using them
import stockRoutes from './app/routes/stockRoutes.js';
import selectedStock from './app/routes/selectedStock.js';
import newsRoutes from './app/routes/newsRoutes.js';
import extractRoutes from './app/routes/extractRoutes.js';
import userRoutes from './app/routes/userRoutes.js';
import stockList from './app/routes/stockList.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Create the transporter for Gmail
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: 'moneystreakservice@gmail.com', // Your email
//     pass: 'ocnb tdqg rrvv vgvq', // Your email password or App password
//   },
// });

// CORS setup
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Array format is preferred
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Add this if you need to handle cookies/authentication
};

app.use(cors(corsOptions));

// Define the endpoint for sending email
// app.post('/send-email', (req, res) => {
//   const { to, subject, text } = req.body;

//   // Mail options
//   const mailOptions = {
//     from: 'moneystreakservice@gmail.com', // Your email
//     to: to, // Receiver's email
//     subject: subject, // Subject of the email
//     text: text, // Content of the email
//   };

//   // Send the email
//   transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//       console.log(error);
//       return res.status(500).json({ message: 'Error sending email', error });
//     } else {
//       console.log('Email sent: ' + info.response);
//       return res.status(200).json({ message: 'Email sent successfully', info });
//     }
//   });
// });

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use('/stock-list', stockList);
app.use('/all_stock', stockRoutes);
app.use('/stock', selectedStock);
app.use('/news', newsRoutes);
app.use('/extract', extractRoutes);
app.use('/auth', userRoutes);

// Cron job
cron.schedule('* * * * *', async () => {
  try {
    console.log('Running cron job for StockSelection');

    const selectedStocks = await prisma.stockSelection.findMany({
      where: { selected: true },
      include: {
        stock: true,
      },
    });

    const selectedStockNames = selectedStocks
      .filter((stock) => stock.stock?.name) // Add null check
      .map((stock) => stock.stock.name);

    console.log('Selected Stock Names:', selectedStockNames);

    // Use Promise.allSettled instead of Promise.all to handle failures better
    const extractResults = await Promise.allSettled(
      selectedStockNames.map(async (name) => {
        try {
          const baseUrl = process.env.NGROK_URL || `http://localhost:${PORT}`;
          const response = await axios.get(
            `${baseUrl}/news?stock_name=${encodeURIComponent(name)}`
          );
          // console.log(
          //   `Data extracted successfully for ${name}:`,
          //   response.data
          // );
          return response.data;
        } catch (error) {
          console.error(`Error extracting data for ${name}:`, error.message);
          throw error;
        }
      })
    );

    const selectedStockIds = selectedStocks
      .filter((stock) => stock.stockId) // Add null check
      .map((stock) => stock.stockId);

    console.log('Selected Stock IDs:', selectedStockIds);

    const selectedNews = await prisma.news.findMany({
      where: {
        stockId: { in: selectedStockIds },
        content: '',
      },
      include: {
        stock: true,
      },
    });

    console.log('Selected News:', selectedNews);

    // Uncomment and modify news extraction if needed
    // const newsExtractionResults = await Promise.allSettled(
    //   selectedNews.map(async (news) => {
    //     // Add your news extraction logic here
    //   })
    // );
  } catch (error) {
    console.error('Error occurred during the cron job:', error.message);
  } finally {
    // Consider adding cleanup code here if needed
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
const host = '0.0.0.0';
app.listen(PORT, host, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle process termination
process.on('SIGTERM', async () => {
  console.log(
    'SIGTERM received. Closing HTTP server and database connections...'
  );
  await prisma.$disconnect();
  process.exit(0);
});
