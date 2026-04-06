const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    detalle: { type: String, required: true, trim: true },
    monto: { type: Number, required: true, min: 0 },
    fecha: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Expense', ExpenseSchema);
