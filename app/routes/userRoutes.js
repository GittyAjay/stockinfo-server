import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

const router = express.Router();

const JWT_SECRET = 'your-secret-key';

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
 *               - device_details
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               mobile:
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
  service: 'gmail',
  auth: {
    user: 'moneystreakservice@gmail.com', // Your email
    pass: 'ocnb tdqg rrvv vgvq', // Your email password or App password
  },
});

// Define the endpoint for sending email
router.post('/send-email', (req, res) => {
  const { to, subject, text } = req.body;

  // Mail options
  const mailOptions = {
    from: 'moneystreakservice@gmail.com', // Your email
    to: to, // Receiver's email
    subject: subject, // Subject of the email
    text: text, // Content of the email
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Error sending email', error });
    } else {
      console.log('Email sent: ' + info.response);
      return res.status(200).json({ message: 'Email sent successfully', info });
    }
  });
});

// Send confirmation email function
const sendConfirmationEmail = async (email, name) => {
  // Set up the email content
  const mailOptions = {
    from: 'moneystreakservice@gmail.com', // Your email
    to: email, // Receiver's email
    subject: 'Welcome to MoneyStreak!', // Subject of the email
    html: `<p>Hello ${name},</p><p>Thank you for signing up! We're excited to have you on board at MoneyStreak.</p><p>Best regards,<br>Your MoneyStreak Team</p>`, // HTML content of the email
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

// Route for creating a new user
router.post('/create-user', async (req, res) => {
  try {
    const { email, name, mobile, device_details } = req.body;

    if (!email || !device_details) {
      return res
        .status(400)
        .json({ error: 'Email and device details are required.' });
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

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        mobile,
        device_details,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Send confirmation email after creating the user
    await sendConfirmationEmail(email, name);

    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating user.' });
  }
});
// Utility function to generate OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999); // Generate a 6-digit OTP
};

// Send OTP email function
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: 'moneystreakservice@gmail.com', // Your email
    to: email, // Receiver's email
    subject: 'Your OTP for login',
    text: `Your OTP for login is: ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error('Error sending OTP email:', error);
  }
};

// Route to send OTP to email on login
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(404)
        .json({ error: 'User with this email does not exist.' });
    }

    // Delete expired OTPs before generating a new one
    await prisma.otp.deleteMany({
      where: {
        email: user.email,
        expiresAt: { lt: new Date() },
      },
    });

    // Generate OTP
    const otp = generateOTP();

    // Save OTP in the database with expiration time (1 hour)
    const otpRecord = await prisma.otp.create({
      data: {
        email: user.email,
        otp: otp.toString(),
        expiresAt: new Date(Date.now() + 3600000), // OTP expires in 1 hour
      },
    });

    // Only send email if OTP was successfully saved
    if (otpRecord) {
      await sendOTPEmail(email, otp);
      res.status(200).json({ message: 'OTP sent to email' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error during login process' });
  }
});

// Route to verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    // Find OTP record for the user
    const otpRecord = await prisma.otp.findFirst({
      where: {
        email,
        otp,
        expiresAt: { gte: new Date() }, // Check if OTP is still valid
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // OTP is valid, issue JWT token
    const user = await prisma.user.findUnique({
      where: { email },
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
    });

    // Remove the OTP record after successful verification
    await prisma.otp.delete({
      where: { id: otpRecord.id },
    });

    res.status(200).json({
      message: 'OTP verified successfully',
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error verifying OTP' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user by sending OTP to email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP and get authentication token
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully and token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid or expired OTP
 *       500:
 *         description: Server error
 */

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
 *     summary: Get paginated news for user's selected stocks
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *         description: Successfully retrieved paginated news
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
 *                       title:
 *                         type: string
 *                       url:
 *                         type: string
 *                       content:
 *                         type: string
 *                       source:
 *                         type: string
 *                       published:
 *                         type: string
 *                         format: date-time
 *                       image:
 *                         type: string
 *                       stockId:
 *                         type: integer
 *                       stockName:
 *                         type: string
 *                       stockSymbol:
 *                         type: string
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

    // Extract pagination parameters from query
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const skip = (page - 1) * pageSize;

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

    // Collect and flatten all news
    const allNews = userStocks.flatMap((selection) =>
      selection.stock.news.map((news) => ({
        ...news,
        stockName: selection.stock.name,
        stockSymbol: selection.stock.symbol,
      }))
    );

    // Sort all news by published date (newest first)
    const sortedNews = allNews.sort(
      (a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime()
    );

    // Calculate pagination
    const total = sortedNews.length;
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

    // Paginate the news
    const paginatedNews = sortedNews.slice(skip, skip + pageSize);

    // Return paginated response
    res.json({
      data: paginatedNews,
      pagination: {
        total,
        pageSize,
        currentPage: page,
        totalPages,
      },
    });
  } catch (error) {
    console.error(error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Error fetching user news' });
  }
});

export default router;
