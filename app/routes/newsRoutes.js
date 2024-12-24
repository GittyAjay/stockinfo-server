import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = express.Router();
// Utility to download and save an image
async function getImageFromLink(url) {
  try {
    // Fetch the HTML content of the webpage
    const response = await axios.get(url);

    // Load the HTML into cheerio for parsing
    const $ = load(response.data);

    // Try to get the Open Graph image
    const ogImage = $("meta[property='og:image']").attr('content');

    // If no Open Graph image, try the Twitter image
    const twitterImage = $("meta[name='twitter:image']").attr('content');

    // If neither of the above, try the standard image tags (e.g., <img> with a large enough src)
    const fallbackImage = $('img').first().attr('src'); // You can refine this to pick the most suitable image

    // Return the first valid image found (OG > Twitter > Fallback)
    return ogImage || twitterImage || fallbackImage || 'No image found';
  } catch (error) {
    console.error('Error fetching image:', error);
    return 'Error fetching image';
  }
}
// Function to scrape summary from Google Search
async function scrapeSummary(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });

    const $ = load(response.data);
    let summary = '';

    $('span.hgKElc').each((_, element) => {
      const text = $(element).text();
      if (text) {
        summary = text;
        return false; // Exit the loop after finding the first match
      }
    });

    return summary || 'Summary not found';
  } catch (error) {
    console.error('Error scraping summary:', error.message);
    return 'Failed to fetch summary';
  }
}

router.get('/', async (req, res) => {
  const query = req.query.stock_name;

  if (!query) {
    return res.status(400).json({ error: "Missing 'stock_name' parameter" });
  }

  const cvid = uuidv4().toUpperCase().replace(/-/g, '');

  try {
    const stock = await prisma.stock.findUnique({
      where: { name: query },
    });

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found.' });
    }

    const queryEncoded = encodeURIComponent(query);
    const url = `https://www.bing.com/news/search?q=${queryEncoded}&qs=n&form=QBNT&sp=-1&lq=0&pq=${queryEncoded}&sc=1-17&sk=&cvid=${cvid}&ghsh=0&ghacc=0&ghpl=`;

    const response = await axios.get(url);
    const $ = load(response.data);

    const articlePromises = $('a.title')
      .map(async (_, element) => {
        const title = $(element).text();
        const link = $(element).attr('href');
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          title
        )}+summary`;
        const summary = await scrapeSummary(googleSearchUrl);
        const imageUrl = await getImageFromLink(link);
        console.log('===imageUrl', imageUrl);

        return {
          title,
          url: link,
          imageUrl,
          content: summary,
          source: 'Bing News',
          published: new Date(), // Adjust if scraping the publish date
          stockId: stock.id, // Associate with the stockId found earlier
        };
      })
      .get();

    const articles = await Promise.all(articlePromises);

    for (const article of articles) {
      await prisma.news.upsert({
        where: { url: article.url, title: article.title },
        update: {
          title: article.title,
          content: article.content,
          source: article.source,
          published: article.published,
          image: article.imageUrl,
        },
        create: {
          title: article.title,
          url: article.url,
          content: article.content,
          source: article.source,
          published: article.published,
          stockId: article.stockId,
          image: article.imageUrl,
        },
      });
    }

    if (articles.length > 0) {
      res.json(articles);
    } else {
      res
        .status(404)
        .json({ error: 'No news found for the given stock name.' });
    }
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: `Failed to fetch news: ${query}` });
  }
});

export default router;
