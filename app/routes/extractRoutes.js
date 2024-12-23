import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
const openai = new OpenAI({
  apiKey:
    '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', // Replace with your actual OpenAI API key
});
const prisma = new PrismaClient();

const router = express.Router();

// /**
//  * @swagger
//  * /extract:
//  *   post:
//  *     summary: Extract news content from a given URL
//  */
router.post('/', async (req, res) => {
  const { url, stock_name } = req.body;

  if (!url || !stock_name) {
    return res.status(400).json({ error: 'URL and stock_name are required.' });
  }

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);

    const pageText = $('body').text();
    const cleanedText = pageText.trim();

    // Find the stock by symbol
    const stock = await prisma.stock.findUnique({
      where: { name: stock_name },
    });

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found.' });
    }
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: `Summarize the following news content into a short, concise summary of 150 words: \n\n${cleanedText}`,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    // Create or update the news content for the specific stock
    const news = await prisma.news.upsert({
      where: { url },
      update: { content: summary, stockId: stock.id },
      create: {
        title: `News for ${stock.name}`,
        url,
        content: summary,
        source: 'Extracted',
        published: new Date(),
        stockId: stock.id,
      },
    });

    // Respond with the news content
    res.json({
      newsId: news.id,
      title: news.title,
      url: news.url,
      content: news.content,
      stock: stock.name,
    });
  } catch (error) {
    // console.error('Error fetching content:', error);
    res.status(500).json({ error: `Failed to fetch URL: ${url}` });
  }
});

export default router;
