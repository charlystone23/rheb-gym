const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String }, // Store name at time of sale in case product is deleted
        quantity: { type: Number, required: true },
        price: { type: Number, required: true } // Price at time of sale
    }],
    total: { type: Number, required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sale', SaleSchema);
