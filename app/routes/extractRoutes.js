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

  console.log('Received request with URL:', url, 'and stock_name:', stock_name); // Debug log for incoming request

  if (!url || !stock_name) {
    console.log('Missing URL or stock_name'); // Debug log for missing fields
    return res.status(400).json({ error: 'URL and stock_name are required.' });
  }

  try {
    console.log('Fetching URL:', url); // Debug log for URL fetching
    const response = await axios.get(url, { timeout: 10000 });
    const $ = load(response.data);

    const pageText = $('body').text();
    const cleanedText = pageText
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '') // Removes non-alphanumeric characters including spaces
      .slice(0, 1000); // Limits the string to 500 characters

    console.log('Fetched content:', cleanedText.slice(0, 200)); // Log a snippet of the fetched content

    // Find the stock by symbol
    console.log('Searching for stock with name:', stock_name); // Debug log for stock search
    const stock = await prisma.stock.findUnique({
      where: { name: stock_name },
    });

    if (!stock) {
      console.log('Stock not found:', stock_name); // Debug log if stock is not found
      return res.status(404).json({ error: 'Stock not found.' });
    }

    console.log('Stock found:', stock.name); // Debug log for successful stock retrieval

    // Call OpenAI for summarization
    console.log('Requesting summary from OpenAI', cleanedText); // Debug log for OpenAI call
    let completion;
    if (cleanedText)
      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: `Summarize the following news content into a short, concise summary of 150 words: \n\n${cleanedText}`,
          },
        ],
      });

    const summary = completion?.choices[0]?.message?.content?.trim() || '';
    console.log('Received summary:', summary); // Log the summary received from OpenAI

    // Create or update the news content for the specific stock
    console.log('Upserting news content for stock:', stock.name); // Debug log for upsert
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
    console.log('News content successfully created/updated'); // Debug log for successful response
    res.json({
      newsId: news.id,
      title: news.title,
      url: news.url,
      content: news.content,
      stock: stock.name,
    });
  } catch (error) {
    console.error('Error fetching content:', error); // Log the error for debugging
    res.status(500).json({ error: `Failed to fetch URL: ${url}` });
  }
});

export default router;
