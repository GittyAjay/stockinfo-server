import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import pLimit from 'p-limit';
import { PrismaClient } from '@prisma/client';

puppeteer.use(StealthPlugin());
const prisma = new PrismaClient();
const router = express.Router();

// /**
//  * @swagger
//  * /all_stock:
//  *   get:
//  *     summary: Retrieve a list of all stocks
//  *     tags: [Stocks]
//  *     responses:
//  *       200:
//  *         description: A list of stocks
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 type: object
//  *                 properties:
//  *                   name:
//  *                     type: string
//  *                   symbol:
//  *                     type: string
//  *                   id:
//  *                     type: number
//  *       500:
//  *         description: Server error
//  */

router.get('/', async (req, res) => {
  const url =
    'https://upstox.com/stocks-market/share-market-listed-company-in-india/';

  try {
    const response = await axios.get(url);
    const $ = load(response.data);

    const anchors = $('td').find('a').toArray();
    const browser = await puppeteer.launch({ headless: true });
    const limit = pLimit(5); // Limit concurrent Puppeteer tasks

    // Define a reusable function to get the stock symbol
    const stockPromises = anchors.map((element) =>
      limit(async () => {
        const stockName = $(element).text().trim();
        // const stockSymbol = await getFirstImageFromGoogle(
        //   stockName.replace(/ /g, '+'),
        //   browser
        // );
        // console.log('stockSymbol===', stockSymbol);
        console.log('stockName===', stockName);

        return {
          name: stockName,
          symbol: '',
          id: Math.random(),
        };
      })
    );

    const stockData = await Promise.all(stockPromises);
    console.log('stockData', stockData);

    for (const stock of stockData) {
      await prisma.stock.upsert({
        where: {
          name: stock.name,
        },
        update: {
          name: stock.name,
        },
        create: {
          symbol: stock.symbol || '',
          name: stock.name,
        },
      });
    }

    await browser.close();
    res.json(stockData);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

/**
 * Function to scrape the stock symbol from Google search results
 * @param {string} stockName
 * @param {puppeteer.Browser} browser
 * @returns {string} symbol
 */
async function getFirstImageFromGoogle(stockName, browser) {
  const googleSearchUrl = `https://www.google.com/search?q=${stockName}&tbm=isch`;
  console.log('googleSearchUrl', googleSearchUrl);

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    await page.goto(googleSearchUrl, { waitUntil: 'domcontentloaded' });

    // Scroll to load images
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    });

    // Wait for image and get the first URL
    await page.waitForSelector('img[src^="https"]', { timeout: 30000 });
    const firstImageUrl = await page.evaluate(() => {
      const imgElement = document.querySelector('img[src^="https"]');
      return imgElement ? imgElement.src : null;
    });

    await page.close();
    console.log('First Image URL:', firstImageUrl);
    return firstImageUrl;
  } catch (error) {
    console.error('Error fetching first image from Google:', error);
    return null;
  }
}

export default router;
