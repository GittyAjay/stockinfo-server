const express = require('express');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey:
    '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', // Replace with your actual OpenAI API key
});

const prisma = new PrismaClient();
const router = express.Router();

// Endpoint to summarize a single news string
router.post('/shorten-news', async (req, res) => {
  try {
    // Extract the news string from the request body
    const { newsContent } = req.body;

    if (!newsContent || typeof newsContent !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing news content' });
    }

    // Use OpenAI to summarize the news content
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content: `Summarize the following news content into a short, concise summary of 150 words: \n\n${newsContent}`,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim();

    if (!summary) {
      return res.status(500).json({ error: 'Failed to generate a summary.' });
    }

    // Save the summarized news to the database
    const savedNews = await prisma.news.create({
      data: {
        id: uuidv4(),
        originalContent: newsContent,
        summary,
        createdAt: new Date(),
      },
    });

    // Respond with the summarized news
    res.json({
      success: true,
      data: {
        id: savedNews.id,
        summary: savedNews.summary,
        createdAt: savedNews.createdAt,
      },
    });
  } catch (error) {
    console.error('Error summarizing news:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while processing the news.' });
  }
});

module.exports = router;
