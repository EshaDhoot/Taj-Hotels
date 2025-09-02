const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 5001; // Using a different port from React

// --- Middleware ---
app.use(cors()); // Allows requests from your React frontend
app.use(express.json()); // Allows server to accept JSON data in request body

// --- MongoDB Connection ---
// Make sure your MongoDB server is running!
mongoose.connect('mongodb+srv://karmveersingh2003:HhimbEtXdWSaxoNG@cluster0.1ani3zw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected...'))
.catch(err => console.error('MongoDB Connection Error:', err));

// --- Mongoose Schema (The structure of our bill in the database) ---
const itemSchema = new mongoose.Schema({
    sno: Number,
    name: String,
    qty: Number,
    rate: Number,
    total: Number,
});

const billSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    customerName: { type: String, required: true },
    customerMobile: { type: String, required: true },
    items: [itemSchema],
    subTotal: { type: Number, required: true },
    gstPercentage: { type: Number, required: true },
    cgst: { type: Number, required: true },
    sgst: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
});

// --- Mongoose Model ---
const Bill = mongoose.model('Bill', billSchema);

// --- API Routes ---

// 1. Route to SAVE a new bill
app.post('/api/bills', async (req, res) => {
    try {
        const newBill = new Bill(req.body);
        const savedBill = await newBill.save();
        res.status(201).json({ message: 'Bill saved successfully!', bill: savedBill });
    } catch (error) {
        // Handle potential duplicate invoice number error
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Error: Invoice number already exists.' });
        }
        console.error('Error saving bill:', error);
        res.status(500).json({ message: 'Error saving bill to the database.' });
    }
});

// 2. Route to GET all saved bills (for an admin view)
app.get('/api/bills', async (req, res) => {
    try {
        // Sort by date in descending order (newest first)
        const bills = await Bill.find({}).sort({ date: -1 });
        res.status(200).json(bills);
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).json({ message: 'Error fetching bills from the database.' });
    }
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});