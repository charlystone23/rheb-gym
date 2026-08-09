const mongoose = require('mongoose');

const StockMovementSchema = new mongoose.Schema({
    productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tipoMovimiento: {
        type: String,
        enum: ['ENTRADA', 'SALIDA_VENTA', 'AJUSTE_MANUAL', 'MERMA_PERDIDA', 'DEVOLUCION'],
        required: true
    },
    cantidadAnterior: { type: Number, required: true },
    cantidadCambio: { type: Number, required: true },
    cantidadNueva: { type: Number, required: true },
    razon: { type: String, required: true },
    fechaHora: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('StockMovement', StockMovementSchema);
