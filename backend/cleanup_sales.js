const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');
const Sale = require('./models/Sale');

async function cleanup() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        console.log('Fetching products...');
        const products = await Product.find({}, '_id');
        const validProductIds = new Set(products.map(p => p._id.toString()));
        console.log(`Found ${validProductIds.size} valid products.`);

        console.log('Fetching sales...');
        const sales = await Sale.find({});
        console.log(`Checking ${sales.length} sales records...`);

        let deletedSales = 0;
        let modifiedSales = 0;

        for (const sale of sales) {
            const originalCount = sale.items.length;
            // Keep items where the product ID exists in our valid set
            const validItems = sale.items.filter(item =>
                item.product && validProductIds.has(item.product.toString())
            );

            if (validItems.length < originalCount) {
                if (validItems.length === 0) {
                    await Sale.findByIdAndDelete(sale._id);
                    deletedSales++;
                    console.log(`Deleted empty sale ${sale._id}`);
                } else {
                    sale.items = validItems;
                    // Recalculate total
                    sale.total = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    await sale.save();
                    modifiedSales++;
                    console.log(`Update sale ${sale._id}: removed ${originalCount - validItems.length} orphaned items. New total: ${sale.total}`);
                }
            }
        }

        console.log('-----------------------------------');
        console.log('Cleanup Complete');
        console.log(`Deleted Sales (became empty): ${deletedSales}`);
        console.log(`Modified Sales (partial removal): ${modifiedSales}`);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Error during cleanup:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

cleanup();
