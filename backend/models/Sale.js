const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
    productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    nombre: { type: String }, // Nombre histórico en momento de venta
    cantidad: { type: Number, required: true },
    precioUnitario: { type: Number, required: true },
    subtotal: { type: Number, required: true }
}, {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Alias virtuals for legacy fields in sale item
SaleItemSchema.virtual('product')
    .get(function () { return this.productoId; })
    .set(function (val) { this.productoId = val; });

SaleItemSchema.virtual('quantity')
    .get(function () { return this.cantidad; })
    .set(function (val) { this.cantidad = val; });

SaleItemSchema.virtual('price')
    .get(function () { return this.precioUnitario; })
    .set(function (val) { this.precioUnitario = val; });

const SaleSchema = new mongoose.Schema({
    fechaHora: { type: Date, default: Date.now },
    items: [SaleItemSchema],
    total: { type: Number, required: true },
    metodoPago: {
        type: String,
        enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO'],
        default: 'EFECTIVO'
    },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Alias virtuals for legacy fields in Sale schema
SaleSchema.virtual('seller')
    .get(function () { return this.usuarioId; })
    .set(function (val) { this.usuarioId = val; });

SaleSchema.virtual('date')
    .get(function () { return this.fechaHora; })
    .set(function (val) { this.fechaHora = val; });

module.exports = mongoose.model('Sale', SaleSchema);
