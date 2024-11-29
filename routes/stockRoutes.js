const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: Fetch stock data from an external website and save it to the database
 *     description: Scrapes stock data from Upstox's listed company page, processes it, and stores it in the database using Prisma. Responds with the scraped stock data.
 *     responses:
 *       200:
 *         description: Successfully fetched and saved stock data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Reliance Industries"
 *                   symbol:
 *                     type: string
 *                     example: "reliance-industries"
 *                   id:
 *                     type: number
 *                     example: 1234567890
 *       500:
 *         description: Failed to fetch stock data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch stock data"
 */

router.get('/', async (req, res) => {
  const url =
    'https://upstox.com/stocks-market/share-market-listed-company-in-india/';

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const stockData = [];
    $('td').each((_, element) => {
      const anchor = $(element).find('a');
      if (anchor.length > 0) {
        const stock = {
          name: anchor.text().trim(),
          symbol: anchor.attr('href').split('/').pop(), // Extract symbol from URL (assuming this is how it's structured)
          id: Math.random(),
        };
        stockData.push(stock);
      }
    });

    // Save stock data to the database (Prisma)
    for (const stock of stockData) {
      await prisma.stock.upsert({
        where: {
          name: stock.name,
        },
        update: {
          name: stock.name,
        },
        create: {
          symbol: stock.symbol,
          name: stock.name,
        },
      });
    }

    res.json(stockData); // Respond with fetched stock data
  } catch (error) {
    console.error('Error fetching stock data:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

module.exports = router;
