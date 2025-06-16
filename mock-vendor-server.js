const express = require('express');

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔔 ${req.method} ${req.path} from ${req.ip}`);
  if (Object.keys(req.body).length > 0) {
    console.log(`[${timestamp}] 📝 Request Body:`, req.body);
  }
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    console.log(`[${timestamp}] 📤 Response ${res.statusCode}:`, data);
    return originalJson.call(this, data);
  };
  
  next();
});

// Mock stock data
const STOCK_DATA = {
  'vendor-a': [
    { sku: 'LAPTOP-001', quantity: 10 },
    { sku: 'MOUSE-001', quantity: 25 },
    { sku: 'KEYBOARD-001', quantity: 15 }
  ],
  'vendor-b': [
    { sku: 'LAPTOP-001', quantity: 5 },
    { sku: 'MOUSE-001', quantity: 30 },
    { sku: 'KEYBOARD-001', quantity: 20 }
  ]
};

const PORT = process.env.PORT || 3001;
const VENDOR_NAME = process.env.VENDOR_NAME || 'VendorA';
const vendorId = PORT === '3001' ? 'vendor-a' : 'vendor-b';

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', vendor: VENDOR_NAME });
});

app.get('/stock', (req, res) => {
  res.json(STOCK_DATA[vendorId] || []);
});

// Assignment requirement: Support atomic stock reduction
app.post('/reduce-stock', (req, res) => {
  try {
    const { sku, quantity } = req.body;
    const stocks = STOCK_DATA[vendorId];
    const item = stocks.find(s => s.sku === sku);
    
    if (!item) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (item.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    item.quantity -= quantity;
    console.log(`${VENDOR_NAME}: Reduced ${sku} by ${quantity}, remaining: ${item.quantity}`);
    
    res.json({ success: true, newQuantity: item.quantity });
  } catch (error) {
    res.status(500).json({ error: 'Stock reduction failed' });
  }
});

app.post('/restore-stock', (req, res) => {
  try {
    const { sku, quantity } = req.body;
    const stocks = STOCK_DATA[vendorId];
    const item = stocks.find(s => s.sku === sku);
    
    if (!item) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    item.quantity += quantity;
    console.log(`${VENDOR_NAME}: Restored ${sku} by ${quantity}, new total: ${item.quantity}`);
    
    res.json({ success: true, newQuantity: item.quantity });
  } catch (error) {
    res.status(500).json({ error: 'Stock restoration failed' });
  }
});

app.get('/info', (req, res) => {
  res.json({
    name: VENDOR_NAME,
    id: vendorId,
    port: PORT,
    stock: STOCK_DATA[vendorId]?.length || 0
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ${VENDOR_NAME} server started on port ${PORT}`);
  console.log(`📦 Available products: ${STOCK_DATA[vendorId]?.length || 0}`);
  console.log(`🔗 Endpoints: /health, /stock, /info, /reduce-stock, /restore-stock`);
  console.log(`⏰ Server started at: ${new Date().toISOString()}`);
}); 