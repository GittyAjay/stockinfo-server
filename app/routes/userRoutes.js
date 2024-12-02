const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const router = express.Router();

const JWT_SECRET = 'your-secret-key';

/**
 * @swagger
 * /auth/create-user:
 *   post:
 *     summary: Create a new user
 */
router.post('/create-user', async (req, res) => {
  try {
    const { email, name, mobile, password, device_details } = req.body;

    if (!email || !password || !device_details) {
      return res
        .status(400)
        .json({ error: 'Email, password, and device details are required.' });
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
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating user.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
    });

    // Return the token and user info (excluding password)
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

module.exports = router;
