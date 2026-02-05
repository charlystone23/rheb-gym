const mongoose = require('mongoose');
require('dotenv').config();

// Define Schemas for the migration script
const PagoSchema = new mongoose.Schema({
    fecha: { type: Date, required: true },
    tipo: { type: String, required: true },
    membresia: {
        nombre: { type: String },
        precio: { type: Number }
    },
    monto: { type: Number }
});

const AlumnoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    historialPagos: [PagoSchema]
});

const Alumno = mongoose.model('Alumno', AlumnoSchema);

const DEFAULT_MEMBERSHIP = {
    nombre: '3 días a la semana',
    precio: 38000
};

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB connected for payment migration...');

        const alumnos = await Alumno.find({});
        let updatedCount = 0;
        let totalPagosUpdated = 0;

        for (const alumno of alumnos) {
            let modified = false;

            alumno.historialPagos.forEach(pago => {
                // Si el pago no tiene membresía o monto, lo asignamos por defecto
                if (!pago.membresia || !pago.membresia.nombre || !pago.monto) {
                    pago.membresia = { ...DEFAULT_MEMBERSHIP };
                    pago.monto = DEFAULT_MEMBERSHIP.precio;
                    modified = true;
                    totalPagosUpdated++;
                }
            });

            if (modified) {
                await alumno.save();
                updatedCount++;
                console.log(`- Actualizados pagos de: ${alumno.nombre}`);
            }
        }

        console.log(`\nMigración completada.`);
        console.log(`- Alumnos actualizados: ${updatedCount}`);
        console.log(`- Total de registros de pago actualizados: ${totalPagosUpdated}`);

        process.exit(0);
    })
    .catch(err => {
        console.error('Error in migration:', err);
        process.exit(1);
    });
