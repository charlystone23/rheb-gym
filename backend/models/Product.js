const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    codigoBarras: { type: String, unique: true, sparse: true, index: true, default: null },
    descripcion: { type: String, default: '' },
    precioVenta: { type: Number, required: true },
    precioCosto: { type: Number, required: true, default: 0 },
    stockActual: { type: Number, required: true, default: 0 },
    stockMinimo: { type: Number, required: true, default: 5 },
    categoria: { type: String, default: 'General' },
    activo: { type: Boolean, default: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Alias virtuals for backward compatibility with legacy fields
ProductSchema.virtual('name')
    .get(function () { return this.nombre; })
    .set(function (val) { this.nombre = val; });

ProductSchema.virtual('price')
    .get(function () { return this.precioVenta; })
    .set(function (val) { this.precioVenta = val; });

ProductSchema.virtual('stock')
    .get(function () { return this.stockActual; })
    .set(function (val) { this.stockActual = val; });

module.exports = mongoose.model('Product', ProductSchema);
