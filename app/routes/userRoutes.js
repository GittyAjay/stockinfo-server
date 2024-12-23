import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

const router = express.Router();

const JWT_SECRET = 'your-secret-key';
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user and get authentication token
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     mobile:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /auth/create-user:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - device_details
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               mobile:
 *                 type: string
 *               password:
 *                 type: string
 *               device_details:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 email:
 *                   type: string
 *                 name:
 *                   type: string
 *                 mobile:
 *                   type: string
 *                 device_details:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */

// Setup Nodemailer transport
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'jerrell.romaguera@ethereal.email',
    pass: 'kBfzQg66qUpseSCbVN',
  },
});

// Send confirmation email function
const sendConfirmationEmail = async (email, name) => {
  // const mailOptions = await transporter.sendMail({
  //   from: '"Maddison Foo Koch 👻" <jerrell.romaguera@ethereal.email>', // sender address
  //   to: 'sapnapanndey@gmail.com', // list of receivers
  //   subject: 'Hello ✔', // Subject line
  //   text: 'Hello world?', // plain text body
  //   html: `Hello ${name},\n\nThank you for signing up! We're excited to have you on board.`, // html body
  // });

  try {
    await transporter
      .sendMail(mailOptions)
      .then((r) => {
        console.log('mail sent', r);
      })
      .catch((e) => {
        console.log('error mail sent', e);
      });
    console.log(`Email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

router.post('/create-user', async (req, res) => {
  try {
    const { email, name, mobile, password, device_details } = req.body;

    if (!email || !password || !device_details) {
      return res
        .status(400)
        .json({ error: 'Email, password, and device details are required.' });
    }

    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        mobile,
        password: hashedPassword,
        device_details,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;

    // Send confirmation email
    // await sendConfirmationEmail(email, name);

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating user.' });
  }
});
router.post('/login', async (req, res) => {
  try {
    console.log('Request body:', req.body); // Log the request body

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(404)
        .json({ error: 'User with this email does not exist.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid password.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error during login' });
  }
});
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *
 * /auth/user-news:
 *   get:
 *     summary: Get news for user's selected stocks
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved news
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   url:
 *                     type: string
 *                   content:
 *                     type: string
 *                   source:
 *                     type: string
 *                   published:
 *                     type: string
 *                     format: date-time
 *                   image:
 *                     type: string
 *                   stockId:
 *                     type: integer
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   stockName:
 *                     type: string
 *                   stockSymbol:
 *                     type: string
 *       401:
 *         description: Unauthorized - No token provided or invalid token
 *       500:
 *         description: Server error while fetching news
 */
router.get('/user-news', async (req, res) => {
  try {
    // Get user ID from JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    // Get user's selected stocks with related news
    const userStocks = await prisma.stockSelection.findMany({
      where: {
        userId: userId,
        selected: true,
      },
      include: {
        stock: {
          include: {
            news: {
              orderBy: {
                published: 'desc',
              },
            },
          },
        },
      },
    });

    const newsData = userStocks.flatMap((selection) =>
      selection.stock.news.map((news) => ({
        ...news,
        stockName: selection.stock.name,
        stockSymbol: selection.stock.symbol,
      }))
    );

    res.json(newsData);
  } catch (error) {
    console.error(error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Error fetching user news' });
  }
});

export default router;
