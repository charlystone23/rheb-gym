const mongoose = require('mongoose');

const IngredienteCostoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    costo: { type: Number, required: true, default: 0 }
}, { _id: true });

const ProductSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    codigoBarras: { type: String, unique: true, sparse: true, index: true, default: null },
    descripcion: { type: String, default: '' },
    precioVenta: { type: Number, required: true },
    precioCosto: { type: Number, default: 0 },
    tipoProducto: { type: String, enum: ['SIMPLE', 'RECETA'], default: 'SIMPLE' },
    ingredientesCosto: [IngredienteCostoSchema],
    stockActual: { type: Number, required: true, default: 0 },
    stockMinimo: { type: Number, default: 0 },
    categoria: { type: String, default: '' },
    activo: { type: Boolean, default: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

ProductSchema.pre('save', function () {
    if (this.tipoProducto === 'RECETA' && Array.isArray(this.ingredientesCosto) && this.ingredientesCosto.length > 0) {
        this.precioCosto = this.ingredientesCosto.reduce((acc, item) => acc + (Number(item.costo) || 0), 0);
    }
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
