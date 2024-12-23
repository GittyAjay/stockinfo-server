import { PrismaClient } from '@prisma/client';
import express from 'express';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @swagger
 * /stock-list:
 *   get:
 *     summary: Get all stocks
 *     description: Returns all records from the Stock table
 *     responses:
 *       200:
 *         description: List of stock records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   price:
 *                     type: number
 *                     format: float
 *                   quantity:
 *                     type: integer
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Server error
 */

router.get('/', async (req, res) => {
  try {
    // Query all records from the Stock table
    const stock = await prisma.stock.findMany();

    // Return the data as a response
    res.json(stock);
  } catch (error) {
    // Handle errors
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;
