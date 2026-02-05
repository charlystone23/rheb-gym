const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const Product = require('./models/Product');

const Sale = require('./models/Sale');
const StockLog = require('./models/StockLog');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Permite Netlify en producción o todo por ahora
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Test Route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState
    });
});

// Schemas
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // En producción: hashear contraseña
    role: { type: String, enum: ['admin', 'entrenador'], default: 'entrenador' },
    nombre: { type: String }
});

const RutinaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    contenido: { type: String, required: true }, // Texto plano
    entrenador: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const MembresiaSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    diasPorSemana: { type: Number }
});

const PagoSchema = new mongoose.Schema({
    fecha: { type: Date, required: true },
    tipo: { type: String, required: true }, // 'efectivo', 'transferencia', 'otros'
    membresia: {
        nombre: { type: String },
        precio: { type: Number }
    },
    monto: { type: Number }
});

const AlumnoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    celular: { type: String, required: true },
    fechaRegistro: { type: Date, default: Date.now },
    estado: { type: String, default: 'activo' },
    historialPagos: [PagoSchema],
    entrenador: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Link al entrenador
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Alumno = mongoose.model('Alumno', AlumnoSchema);
const Rutina = mongoose.model('Rutina', RutinaSchema);
const Membresia = mongoose.model('Membresia', MembresiaSchema);

// --- API Routes ---

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Buscamos usuario por nombre y contraseña (texto plano por ahora)
        const user = await User.findOne({ username, password });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        // Retornamos el usuario (sin password idealmente, pero para simpleza lo enviamos todo o filtramos)
        res.json({
            success: true,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                nombre: user.nombre
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE USER
app.post('/api/users', async (req, res) => {
    try {
        const newUser = new User(req.body);
        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET ALL USERS
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Excluir password
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        // Si no se envía password, no lo actualizamos
        if (!updateData.password) {
            delete updateData.password;
        }

        const user = await User.findByIdAndUpdate(id, updateData, { new: true });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE USER
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userToDelete = await User.findById(id);

        if (!userToDelete) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Restricción: No se pueden eliminar administradores para proteger el acceso al sistema
        if (userToDelete.role === 'admin') {
            return res.status(403).json({
                error: 'No se puede eliminar a un usuario con rol administrador para proteger el acceso al sistema.'
            });
        }

        // Si es un entrenador, eliminamos también sus alumnos (Eliminación en cadena)
        if (userToDelete.role === 'entrenador') {
            await Alumno.deleteMany({ entrenador: id });
            // También podríamos limpiar Rutinas si fuera necesario
            await Rutina.deleteMany({ entrenador: id });
        }

        await User.findByIdAndDelete(id);
        res.json({ message: 'Usuario y sus datos asociados eliminados correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Entrenadores con sus Alumnos (Vista Admin)
app.get('/api/entrenadores', async (req, res) => {
    try {
        const entrenadores = await User.find({ role: 'entrenador' });

        // Para simplificar, hacemos un "join" manual o usamos aggregate
        // Aquí recuperamos los alumnos de cada entrenador
        const reporte = await Promise.all(entrenadores.map(async (entrenador) => {
            const alumnos = await Alumno.find({ entrenador: entrenador._id });
            return {
                ...entrenador.toObject(),
                alumnos: alumnos
            };
        }));

        res.json(reporte);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Alumnos (Filtrado por entrenador si se pasa ?entrenadorId=...)
app.get('/api/alumnos', async (req, res) => {
    try {
        const filter = {};
        if (req.query.entrenadorId) {
            filter.entrenador = req.query.entrenadorId;
        }
        const alumnos = await Alumno.find(filter).sort({ createdAt: -1 });
        res.json(alumnos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE Alumno (Asignado a un entrenador)
app.post('/api/alumnos', async (req, res) => {
    try {
        // req.body debe incluir 'entrenador' (ID)
        const nuevoAlumno = new Alumno(req.body);
        const savedAlumno = await nuevoAlumno.save();
        res.status(201).json(savedAlumno);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE Alumno
app.put('/api/alumnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Alumno.findByIdAndUpdate(id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Alumno no encontrado' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE Alumno
app.delete('/api/alumnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Alumno.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ error: 'Alumno no encontrado' });
        res.json({ message: 'Alumno eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MEMBERSHIP ROUTES ---
app.get('/api/membresias', async (req, res) => {
    try {
        const memberships = await Membresia.find();
        res.json(memberships);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/membresias', async (req, res) => {
    try {
        const newMembresia = new Membresia(req.body);
        const saved = await newMembresia.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/membresias/:id', async (req, res) => {
    try {
        const updated = await Membresia.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/membresias/:id', async (req, res) => {
    try {
        await Membresia.findByIdAndDelete(req.params.id);
        res.json({ message: 'Membresia eliminada' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// CREATE Rutina

// ADD Payment
app.post('/api/alumnos/:id/pagos', async (req, res) => {
    try {
        const { id } = req.params;
        const pago = req.body;

        const alumno = await Alumno.findByIdAndUpdate(
            id,
            { $push: { historialPagos: pago } },
            { new: true }
        );

        if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

        res.json(alumno);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// --- PRODUCT ROUTES ---

// GET All Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ name: 1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE Product
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE Product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedProduct) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE Product Stock (Manual Adjustment)
app.post('/api/products/:id/adjust-stock', async (req, res) => {
    try {
        const { id } = req.params;
        const { newStock, reason } = req.body;

        const product = await Product.findById(id);
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

        const previousStock = product.stock;
        const change = newStock - previousStock;

        // Update Product
        product.stock = newStock;
        await product.save();

        // Create Log
        const log = new StockLog({
            product: id,
            previousStock,
            newStock,
            change,
            reason
        });
        await log.save();

        res.json({ message: 'Stock actualizado', product, log });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET Product Stock Logs
app.get('/api/products/:id/stock-logs', async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await StockLog.find({ product: id }).sort({ date: -1 }).limit(5);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Product.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ error: 'Producto no encontrado' });

        // Cascading Delete: Clean up sales
        const sales = await Sale.find({ "items.product": id });

        for (const sale of sales) {
            // Filter out the deleted product
            const originalLength = sale.items.length;
            sale.items = sale.items.filter(item => item.product.toString() !== id);

            if (sale.items.length === 0) {
                // If no items left, delete the sale entirely
                await Sale.findByIdAndDelete(sale._id);
            } else if (sale.items.length < originalLength) {
                // Recalculate total if items were removed
                sale.total = sale.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                await sale.save();
            }
        }

        res.json({ message: 'Producto y sus ventas asociadas eliminados' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SALES ROUTES ---

// CREATE Sale (and update stock)
// CREATE Sale (and update stock)
app.post('/api/sales', async (req, res) => {
    try {
        const { items, total, seller } = req.body; // items: [{ product: id, quantity: n, price: p }]

        // Validate stock and prepare bulk updates
        const bulkOps = [];
        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({ error: `Producto con ID ${item.product} no encontrado` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` });
            }

            // Push update operation
            bulkOps.push({
                updateOne: {
                    filter: { _id: item.product },
                    update: { $inc: { stock: -item.quantity } }
                }
            });

            // Save product name in sale item (in case product is deleted later)
            item.name = product.name;
        }

        // Execute bulk write to update stocks
        await Product.bulkWrite(bulkOps);

        // Create Sale Record
        const newSale = new Sale({ items, total, seller });
        const savedSale = await newSale.save();

        res.status(201).json(savedSale);

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET Recent Sales
app.get('/api/sales', async (req, res) => {
    try {
        const sales = await Sale.find().populate('seller', 'nombre apellido').sort({ date: -1 }).limit(50);
        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Product Sales Statistics
app.get('/api/products/:id/sales-stats', async (req, res) => {
    try {
        const { id } = req.params;
        const { sellerId } = req.query;

        const filter = { "items.product": id };
        if (sellerId) {
            filter.seller = sellerId;
        }

        // Find sales containing this product
        const sales = await Sale.find(filter).populate('seller', 'nombre apellido').sort({ date: -1 });

        let totalSold = 0;
        const salesByTrainer = {};
        const salesLog = [];

        sales.forEach(sale => {
            const item = sale.items.find(i => i.product.toString() === id);
            if (item) {
                totalSold += item.quantity;
                const trainerName = sale.seller
                    ? `${sale.seller.nombre} ${sale.seller.apellido || ''}`.trim()
                    : 'Desconocido/Admin';

                // Aggregate for breakdown
                if (!salesByTrainer[trainerName]) {
                    salesByTrainer[trainerName] = 0;
                }
                salesByTrainer[trainerName] += item.quantity;

                // Add to detailed log
                salesLog.push({
                    _id: sale._id,
                    date: sale.date,
                    sellerName: trainerName,
                    quantity: item.quantity,
                    amount: item.price * item.quantity
                });
            }
        });

        const breakdown = Object.entries(salesByTrainer).map(([name, quantity]) => ({ name, quantity }));

        res.json({ totalSold, breakdown, salesLog });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET General Sales Stats
app.get('/api/sales/general-stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const filter = {};

        if (startDate && endDate) {
            // Adjust dates to cover full days if needed, or assume frontend sends full ISO strings
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            filter.date = {
                $gte: start,
                $lte: end
            };
        }

        const sales = await Sale.find(filter).populate('seller', 'nombre apellido');

        const statsBySeller = {};
        let totalRevenue = 0;
        let totalSalesCount = 0;

        sales.forEach(sale => {
            const seller = sale.seller;
            // Name Fix: Handle undefined lastname and trim
            const sellerName = seller
                ? `${seller.nombre || ''} ${seller.apellido || ''}`.trim() || 'Sin Nombre'
                : 'Desconocido/Admin';

            if (!statsBySeller[sellerName]) {
                statsBySeller[sellerName] = {
                    name: sellerName,
                    salesCount: 0,
                    revenue: 0,
                    products: {}
                };
            }

            statsBySeller[sellerName].salesCount += 1;
            statsBySeller[sellerName].revenue += sale.total;

            // Aggregate products
            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const pName = item.name || 'Producto Desconocido';
                    if (!statsBySeller[sellerName].products[pName]) {
                        statsBySeller[sellerName].products[pName] = { count: 0, revenue: 0 };
                    }
                    statsBySeller[sellerName].products[pName].count += item.quantity;
                    statsBySeller[sellerName].products[pName].revenue += (item.price * item.quantity);
                });
            }

            totalSalesCount += 1;
            totalRevenue += sale.total;
        });

        // Convert breakdown
        const breakdown = Object.values(statsBySeller).map(seller => ({
            ...seller,
            products: Object.entries(seller.products).map(([name, stats]) => ({
                name,
                quantity: stats.count,
                revenue: stats.revenue
            })).sort((a, b) => b.revenue - a.revenue)
        })).sort((a, b) => b.revenue - a.revenue);

        res.json({
            totalRevenue,
            totalSalesCount,
            breakdown
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
