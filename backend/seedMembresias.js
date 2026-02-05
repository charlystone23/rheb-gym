const mongoose = require('mongoose');
require('dotenv').config();

const MembresiaSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    precio: { type: Number, required: true },
    diasPorSemana: { type: Number }
});

const Membresia = mongoose.model('Membresia', MembresiaSchema);

const defaultMembresias = [
    { nombre: '2 días a la semana', precio: 35000, diasPorSemana: 2 },
    { nombre: '3 días a la semana', precio: 38000, diasPorSemana: 3 },
    { nombre: '5 días a la semana', precio: 42000, diasPorSemana: 5 }
];

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB connected for seeding memberships...');

        // Insertar si no existen
        for (const m of defaultMembresias) {
            const exists = await Membresia.findOne({ nombre: m.nombre });
            if (!exists) {
                await Membresia.create(m);
                console.log(`- Creada membresía: ${m.nombre}`);
            } else {
                console.log(`- Ya existe la membresía: ${m.nombre}`);
            }
        }

        console.log('Seed de membresías completado.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error seeding memberships:', err);
        process.exit(1);
    });
