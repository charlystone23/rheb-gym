require('dotenv').config();
const mongoose = require('mongoose');

const url = process.env.MONGO_URI;

mongoose.connect(url)
    .then(async () => {
        const User = mongoose.model('User', new mongoose.Schema({ role: String, nombre: String }));
        const Alumno = mongoose.model('Alumno', new mongoose.Schema({
            nombre: String,
            apellido: String,
            celular: String,
            entrenador: mongoose.Schema.Types.ObjectId,
            estado: String
        }, { strict: false }));

        const entrenadores = await User.find({ role: 'entrenador' });
        let totalCreated = 0;

        for (const entre of entrenadores) {
            console.log(`Creando 10 alumnos para el entrenador: ${entre.nombre || entre._id}`);
            for (let i = 1; i <= 10; i++) {
                await Alumno.create({
                    nombre: `TestAlumno ${i}`,
                    apellido: `(de ${entre.nombre || String(entre._id).substring(0, 4)})`,
                    celular: '555-0000',
                    entrenador: entre._id,
                    estado: 'activo'
                });
                totalCreated++;
            }
        }
        console.log(`\n¡Creados ${totalCreated} alumnos exitosamente en la BD de Desarrollo!`);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
