const mongoose = require('mongoose');
require('dotenv').config();

// Re-usamos el esquema definido en index.js, pero para un script aislado
// es mejor re-definirlo brevemente o exportarlo del index. 
// Para simplificar, lo definimos aquí.

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'entrenador'], default: 'entrenador' },
    nombre: { type: String }
});

const User = mongoose.model('User', UserSchema);

const users = [
    { username: 'admin', password: 'admin', role: 'admin', nombre: 'Administrador' },
    { username: 'entrenador1', password: 'user', role: 'entrenador', nombre: 'Entrenador Uno' },
    { username: 'entrenador2', password: 'user', role: 'entrenador', nombre: 'Entrenador Dos' },
    { username: 'entrenador3', password: 'user', role: 'entrenador', nombre: 'Entrenador Tres' }
];

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB connected for seeding...');

        // Limpiar usuarios existentes para evitar duplicados
        await User.deleteMany({});
        console.log('Usuarios existentes eliminados.');

        // Insertar nuevos
        await User.insertMany(users);
        console.log('Usuarios por defecto creados:');
        users.forEach(u => console.log(`- ${u.username} (${u.role})`));

        console.log('Seed completado.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error seeding database:', err);
        process.exit(1);
    });
