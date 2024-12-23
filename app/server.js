import express from 'express';
import stockRoutes from './routes/stockRoutes.js';
import selectedStock from './routes/selectedStock.js';
import newsRoutes from './routes/newsRoutes.js';
import extractRoutes from './routes/extractRoutes.js';
import userRoutes from './routes/userRoutes.js';
// import openAiRoutes from './routes/openAiRoutes.js';

const app = express();
const PORT = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// Use routes
app.use('/all_stock', stockRoutes);
app.use('/stock', selectedStock);
// app.use('/openai', openAiRoutes);
app.use('/news', newsRoutes);
app.use('/extract', extractRoutes);
app.use('/auth', userRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
