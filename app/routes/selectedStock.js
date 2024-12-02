const express = require('express');
const { PrismaClient } = require('@prisma/client');
/**
 * @swagger
 * /stock/select-stock:
 *   post:
 *     summary: Select or deselect a stock for a user
 *     tags: [Stocks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - stockId
 *               - selected
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user
 *               stockId:
 *                 type: string
 *                 description: The ID of the stock
 *               selected:
 *                 type: boolean
 *                 description: Whether to select or deselect the stock
 *     responses:
 *       200:
 *         description: Stock selection updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     stockId:
 *                       type: string
 *                     selected:
 *                       type: boolean
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Stock or user not found
 *       500:
 *         description: Server error
 */

const prisma = new PrismaClient();
const router = express.Router();

router.post('/select-stock', async (req, res) => {
  const { userId, stockId, selected } = req.body;

  if (!userId || !stockId || typeof selected !== 'boolean') {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    const stock = await prisma.stock.findUnique({
      where: { id: stockId },
    });

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stockSelection = await prisma.stockSelection.upsert({
      where: {
        userId_stockId: {
          userId,
          stockId,
        },
      },
      update: {
        selected,
      },
      create: {
        userId,
        stockId,
        selected,
      },
    });

    return res.status(200).json({
      message: 'Stock selection updated successfully',
      data: stockSelection,
    });
  } catch (error) {
    console.error('Error updating stock selection:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete stock selection
router.delete('/delete-stock-selection', async (req, res) => {
  const { userId, stockId } = req.body;

  if (!userId || !stockId) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    await prisma.stockSelection.delete({
      where: {
        userId_stockId: {
          userId,
          stockId,
        },
      },
    });

    return res.status(200).json({
      message: 'Stock selection deleted successfully',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      // Record not found error
      return res.status(404).json({ error: 'Stock selection not found' });
    }
    console.error('Error deleting stock selection:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
//Get all stock
router.post('/all_stock', async (req, res) => {
  try {
    const stocks = await prisma.stock.findMany();

    return res.status(200).json({
      message: 'Stocks retrieved successfully',
      data: stocks,
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    return res.status(500).json({
      message: 'An error occurred while retrieving stocks',
      error: error.message,
    });
  }
});

module.exports = router;
