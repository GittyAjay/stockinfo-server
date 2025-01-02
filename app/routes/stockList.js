import { PrismaClient } from '@prisma/client';
import express from 'express';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @swagger
 * /stocks:
 *   get:
 *     summary: Get paginated list of stocks
 *     description: Returns paginated records from the Stock table
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Paginated list of stock records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                         format: float
 *                       quantity:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       400:
 *         description: Invalid pagination parameters
 *       500:
 *         description: Server error
 */

router.get('/', async (req, res) => {
  try {
    // Extract pagination parameters from query
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(req.query.pageSize) || 10)
    );

    // Calculate skip value for pagination
    const skip = (page - 1) * pageSize;

    // Get total count of records
    const total = await prisma.stock.count();

    // Calculate total pages
    const totalPages = Math.ceil(total / pageSize);

    // Validate page number
    if (page > totalPages && total > 0) {
      return res.status(400).json({
        error: 'Page number exceeds total pages',
        pagination: {
          total,
          pageSize,
          currentPage: page,
          totalPages,
        },
      });
    }

    // Query records with pagination
    const stocks = await prisma.stock.findMany({
      skip,
      take: pageSize,
      orderBy: {
        id: 'asc', // You can modify the sorting as needed
      },
    });

    // Return paginated response
    res.json({
      data: stocks,
      pagination: {
        total,
        pageSize,
        currentPage: page,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

/**
 * @swagger
 * /stocks/search:
 *   get:
 *     summary: Search stocks by name
 *     description: Search across all stock records by name and return all matches
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for stock name (case-insensitive)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, symbol, sector, industry, createdAt]
 *           default: name
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Complete list of matching stock records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       symbol:
 *                         type: string
 *                       name:
 *                         type: string
 *                       sector:
 *                         type: string
 *                         nullable: true
 *                       industry:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                   description: Total number of matching records
 *       500:
 *         description: Server error
 */

router.get('/search', async (req, res) => {
  try {
    const {
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      skip = 0,
      take = 20,
    } = req.query;
    console.log('/search');
    // Validate and sanitize inputs
    const validSortFields = [
      'name',
      'symbol',
      'sector',
      'industry',
      'createdAt',
    ];
    const validSortOrders = ['asc', 'desc'];

    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({ error: 'Invalid sort field' });
    }
    if (!validSortOrders.includes(sortOrder)) {
      return res.status(400).json({ error: 'Invalid sort order' });
    }

    // Build where condition
    let where = {};
    if (search) {
      where = {
        name: {
          contains: search.trim(),
          mode: 'insensitive',
        },
      };
    }

    // Query database
    const stocks = await prisma.stock.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: parseInt(skip, 10),
      take: parseInt(take, 10),
    });

    // Count total matching records
    const total = await prisma.stock.count({ where });

    // Return response
    res.json({ data: stocks, total });
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;
