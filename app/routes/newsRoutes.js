const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// Utility to download and save an image
const downloadImage = async (url, filename) => {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  const imagePath = path.join(__dirname, 'images', filename);
  return new Promise((resolve, reject) => {
    const stream = response.data.pipe(fs.createWriteStream(imagePath));
    stream.on('finish', () => resolve(imagePath));
    stream.on('error', reject);
  });
};

/**
 * @swagger
 * /news:
 *   get:
 *     summary: Get news articles for a given stock name
 */
router.get('/', async (req, res) => {
  const query = req.query.stock_name;

  if (!query) {
    return res.status(400).json({ error: "Missing 'stock_name' parameter" });
  }

  const cvid = uuidv4().toUpperCase().replace(/-/g, '');

  try {
    // Check if the stock exists in the database
    const stock = await prisma.stock.findUnique({
      where: { name: query },
    });

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found.' });
    }

    const queryEncoded = encodeURIComponent(query);
    const url = `https://www.bing.com/news/search?q=${queryEncoded}&qs=n&form=QBNT&sp=-1&lq=0&pq=${queryEncoded}&sc=1-17&sk=&cvid=${cvid}&ghsh=0&ghacc=0&ghpl=`;

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const articles = [];
    $('a.title').each((_, element) => {
      const title = $(element).text();
      const link = $(element).attr('href');
      const imageUrl = $(element).find('div.citm_img img').attr('src');

      console.log('imageUrl', imageUrl);

      // Prepare article data
      const article = {
        title,
        url: link,
        imageUrl,
        content: '', // Add logic to scrape detailed content if needed
        source: 'Bing News',
        published: new Date(), // Adjust if scraping the publish date
        stockId: stock.id, // Associate with the stockId found earlier
      };

      articles.push(article);
    });

    // Save or update news articles in the database
    for (const article of articles) {
      let imagePath = null;
      if (article.imageUrl) {
        try {
          const imageFilename = `${uuidv4()}.jpg`;
          imagePath = await downloadImage(article.imageUrl, imageFilename);
        } catch (error) {
          console.error(
            `Failed to download image for ${article.title}:`,
            error
          );
        }
      }

      await prisma.news.upsert({
        where: { url: article.url, title: article.title },
        update: {
          title: article.title,
          content: article.content,
          source: article.source,
          published: article.published,
          image: imagePath,
        },
        create: {
          title: article.title,
          url: article.url,
          content: article.content,
          source: article.source,
          published: article.published,
          stockId: article.stockId,
          image: imagePath,
        },
      });
    }

    // Respond with the articles
    if (articles.length > 0) {
      res.json(articles);
    } else {
      res
        .status(404)
        .json({ error: 'No news found for the given stock name.' });
    }
  } catch (error) {
    // console.error('Error fetching news:', error);
    res.status(500).json({ error: `Failed to fetch news: ${query}` });
  }
});

module.exports = router;
