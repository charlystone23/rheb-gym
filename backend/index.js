const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const Product = require('./models/Product');
const Expense = require('./models/Expense');

const Sale = require('./models/Sale');
const StockLog = require('./models/StockLog');
const StockMovement = require('./models/StockMovement');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('--- Servidor Iniciando ---');
console.log('Origin permitido:', process.env.FRONTEND_URL || 'No definido');
// Middleware
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_2,
    'https://rheb-app.netlify.app',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000'
].filter(Boolean).map(url => url.trim().replace(/\/$/, "")); // Quitar espacios y barra final si existe

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir solicitudes sin origin (como herramientas de test local o server-to-server)
        if (!origin) return callback(null, true);

        // Limpiar el origen recibido omitiendo la barra final para comparar
        const cleanOrigin = origin.trim().replace(/\/$/, "");

        console.log('--- CORS Check ---');
        console.log('Recibido:', origin);
        console.log('Limpio:', cleanOrigin);
        console.log('Válidos:', allowedOrigins);

        if (allowedOrigins.includes(cleanOrigin)) {
            console.log('CORS Aceptado');
            callback(null, true);
        } else {
            console.warn('CORS Denegado para:', origin);
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };
let mongoConnectionErrorLogged = false;

function logMongoConnectionError(err) {
    if (mongoConnectionErrorLogged) return;
    mongoConnectionErrorLogged = true;

    const code = err?.code ? ` (${err.code})` : '';
    const host = err?.hostname ? ` Host: ${err.hostname}.` : '';
    console.warn(`MongoDB no disponible${code}. El backend sigue levantado, pero las rutas que usan base de datos no van a responder correctamente.${host}`);
}

mongoose.connect(process.env.MONGO_URI, clientOptions)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(logMongoConnectionError);

mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to DB Cluster');
});

mongoose.connection.on('error', (err) => {
    logMongoConnectionError(err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

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
    role: { type: String, enum: ['admin', 'ADMIN_VENTAS', 'ADMIN', 'entrenador'], default: 'entrenador' },
    nombre: { type: String },
    estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    fechaInactivacion: { type: Date, default: null },
    fechaReactivacion: { type: Date, default: null },
    linkedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedTrainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    includeInAdminStats: { type: Boolean, default: true }
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

const HorarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    horaInicio: { type: Number, required: true },
    horaFin: { type: Number, required: true },
    dias: [{ type: String }],
    entrenadores: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // up to 3
    asignaciones: [{
        alumno: { type: mongoose.Schema.Types.ObjectId, ref: 'Alumno' },
        dia: { type: String },
        hora: { type: Number }
    }],
    cuposExtra: [{
        dia: { type: String },
        hora: { type: Number },
        cantidad: { type: Number, default: 0 }
    }]
}, { timestamps: true });

const PagoSchema = new mongoose.Schema({
    fecha: { type: Date, required: true },
    mesQueAbona: { type: Number, min: 1, max: 12, default: null },
    anioQueAbona: { type: Number, default: null },
    tipo: { type: String, required: true }, // 'efectivo', 'transferencia', 'descuento', 'promesa de pago'
    detalle: { type: String, default: "" },
    medio: { type: String, default: "" },
    esParcial: { type: Boolean, default: false },
    completaParcial: { type: Boolean, default: false },
    montoObjetivo: { type: Number, default: null },
    saldoPendiente: { type: Number, default: 0 },
    membresia: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Membresia' },
        nombre: { type: String },
        precio: { type: Number }
    },
    monto: { type: Number },
    montoInformado: { type: Number, default: null }
}, { timestamps: true });

const PeriodoActividadSchema = new mongoose.Schema({
    inicio: { type: Date, required: true },
    fin: { type: Date, default: null }
}, { _id: false });

const AlumnoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    celular: { type: String, required: false },
    fechaRegistro: { type: Date, default: Date.now },
    estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
    fechaInactivacion: { type: Date, default: null },
    inactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fechaReactivacion: { type: Date, default: null },
    reactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    periodosActividad: { type: [PeriodoActividadSchema], default: [] },
    historialPagos: [PagoSchema],
    entrenador: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Link al entrenador
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Alumno = mongoose.model('Alumno', AlumnoSchema);
const Rutina = mongoose.model('Rutina', RutinaSchema);
const Membresia = mongoose.model('Membresia', MembresiaSchema);
const Horario = mongoose.model('Horario', HorarioSchema);

async function migrateExistingUsers() {
    try {
        await User.updateMany(
            { estado: { $exists: false } },
            { $set: { estado: 'activo' } }
        );
        await User.updateMany(
            { fechaInactivacion: { $exists: false } },
            { $set: { fechaInactivacion: null } }
        );
        await User.updateMany(
            { fechaReactivacion: { $exists: false } },
            { $set: { fechaReactivacion: null } }
        );
    } catch (err) {
        console.warn('No se pudo completar la migracion de usuarios:', err.message);
    }
}

async function migrateExistingStudents() {
    try {
        await Alumno.updateMany(
            { estado: { $exists: false } },
            { $set: { estado: 'activo' } }
        );
        await Alumno.updateMany(
            { fechaInactivacion: { $exists: false } },
            { $set: { fechaInactivacion: null } }
        );
        await Alumno.updateMany(
            { inactivatedBy: { $exists: false } },
            { $set: { inactivatedBy: null } }
        );
        await Alumno.updateMany(
            { fechaReactivacion: { $exists: false } },
            { $set: { fechaReactivacion: null } }
        );
        await Alumno.updateMany(
            { reactivatedBy: { $exists: false } },
            { $set: { reactivatedBy: null } }
        );

        const alumnos = await Alumno.find({
            $or: [
                { periodosActividad: { $exists: false } },
                { periodosActividad: { $size: 0 } }
            ]
        });

        for (const alumno of alumnos) {
            const inicio = alumno.fechaRegistro || alumno.createdAt || new Date();
            const periodosActividad = [{
                inicio,
                fin: alumno.estado === 'inactivo' ? (alumno.fechaInactivacion || new Date()) : null
            }];

            alumno.periodosActividad = periodosActividad;
            await alumno.save();
        }
    } catch (err) {
        console.warn('No se pudo completar la migracion de alumnos:', err.message);
    }
}

function ensureAlumnoPeriodos(alumno) {
    if (!alumno.periodosActividad || alumno.periodosActividad.length === 0) {
        alumno.periodosActividad = [{
            inicio: alumno.fechaRegistro || alumno.createdAt || new Date(),
            fin: alumno.estado === 'inactivo' ? (alumno.fechaInactivacion || new Date()) : null
        }];
    }

    return alumno.periodosActividad;
}

mongoose.connection.once('connected', () => {
    migrateExistingUsers();
});

mongoose.connection.once('connected', () => {
    migrateExistingStudents();
});

async function removeAlumnoAssignments(alumnoId) {
    await Horario.updateMany(
        { 'asignaciones.alumno': alumnoId },
        { $pull: { asignaciones: { alumno: alumnoId } } }
    );
}

function sanitizeUser(user) {
    if (!user) return null;

    return {
        _id: user._id,
        username: user.username,
        role: user.role,
        nombre: user.nombre,
        estado: user.estado ?? 'activo',
        fechaInactivacion: user.fechaInactivacion ?? null,
        fechaReactivacion: user.fechaReactivacion ?? null,
        linkedAdminId: user.linkedAdmin?._id || user.linkedAdmin || null,
        linkedTrainerId: user.linkedTrainer?._id || user.linkedTrainer || null,
        includeInAdminStats: user.includeInAdminStats ?? true
    };
}

// --- API Routes ---

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Buscamos usuario por nombre y contraseña (texto plano por ahora)
        const user = await User.findOne({ username, password })
            .populate('linkedAdmin', 'username role nombre')
            .populate('linkedTrainer', 'username role nombre');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        if (user.estado === 'inactivo') {
            return res.status(403).json({ success: false, message: 'Este usuario esta inactivo. Un administrador debe habilitarlo nuevamente.' });
        }

        // Retornamos el usuario (sin password idealmente, pero para simpleza lo enviamos todo o filtramos)
        res.json({
            success: true,
            user: sanitizeUser(user)
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
        res.status(201).json(sanitizeUser(savedUser));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/users/:id/create-linked-trainer', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, nombre } = req.body;

        const adminUser = await User.findById(id);
        if (!adminUser) {
            return res.status(404).json({ error: 'Administrador no encontrado' });
        }

        if (adminUser.role !== 'admin') {
            return res.status(400).json({ error: 'Solo un administrador puede crear su entrenador vinculado' });
        }

        if (adminUser.linkedTrainer) {
            return res.status(400).json({ error: 'Este administrador ya tiene un entrenador vinculado' });
        }

        const linkedTrainer = await User.create({
            username,
            password,
            nombre,
            role: 'entrenador',
            linkedAdmin: adminUser._id
        });

        adminUser.linkedTrainer = linkedTrainer._id;
        await adminUser.save();

        res.status(201).json({
            admin: sanitizeUser(adminUser),
            trainer: sanitizeUser(linkedTrainer)
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET ALL USERS
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Excluir password
        res.json(users.map(sanitizeUser));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id, '-password');
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(sanitizeUser(user));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        const existingUser = await User.findById(id);

        if (!existingUser) return res.status(404).json({ error: 'Usuario no encontrado' });

        if (
            updateData.role &&
            updateData.role !== existingUser.role &&
            ((existingUser.linkedAdmin && existingUser.role === 'entrenador') ||
             (existingUser.linkedTrainer && existingUser.role === 'admin'))
        ) {
            return res.status(400).json({
                error: 'No se puede cambiar el rol de un usuario que está vinculado con otro perfil.'
            });
        }

        // Si no se envía password, no lo actualizamos
        if (!updateData.password) {
            delete updateData.password;
        }

        if (updateData.estado) {
            delete updateData.estado;
        }

        const user = await User.findByIdAndUpdate(id, updateData, { new: true });

        res.json(sanitizeUser(user));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/users/:id/deactivate', async (req, res) => {
    try {
        const { id } = req.params;
        const userToDeactivate = await User.findById(id);

        if (!userToDeactivate) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (userToDeactivate.role !== 'entrenador') {
            return res.status(400).json({ error: 'Solo se pueden desactivar entrenadores.' });
        }

        if (userToDeactivate.estado === 'inactivo') {
            return res.status(400).json({ error: 'El entrenador ya esta inactivo.' });
        }

        userToDeactivate.estado = 'inactivo';
        userToDeactivate.fechaInactivacion = new Date();
        userToDeactivate.fechaReactivacion = null;
        await userToDeactivate.save();

        res.json({ message: 'Entrenador desactivado correctamente', user: sanitizeUser(userToDeactivate) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users/:id/reactivate', async (req, res) => {
    try {
        const { id } = req.params;
        const userToReactivate = await User.findById(id);

        if (!userToReactivate) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (userToReactivate.role !== 'entrenador') {
            return res.status(400).json({ error: 'Solo se pueden reactivar entrenadores.' });
        }

        userToReactivate.estado = 'activo';
        userToReactivate.fechaInactivacion = null;
        userToReactivate.fechaReactivacion = new Date();
        await userToReactivate.save();

        res.json({ message: 'Entrenador reactivado correctamente', user: sanitizeUser(userToReactivate) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const hardDelete = String(req.query.hardDelete || '').toLowerCase() === 'true';
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

        if (!hardDelete) {
            return res.status(400).json({
                error: 'La eliminacion definitiva requiere confirmacion explicita.'
            });
        }

        // Si es un entrenador, eliminamos también sus alumnos (Eliminación en cadena)
        if (userToDelete.role === 'entrenador') {
            await Alumno.deleteMany({ entrenador: id });
            // También podríamos limpiar Rutinas si fuera necesario
            await Rutina.deleteMany({ entrenador: id });
            if (userToDelete.linkedAdmin) {
                await User.findByIdAndUpdate(userToDelete.linkedAdmin, { $unset: { linkedTrainer: 1 } });
            }
        }

        if (userToDelete.role === 'admin' && userToDelete.linkedTrainer) {
            await User.findByIdAndUpdate(userToDelete.linkedTrainer, { $unset: { linkedAdmin: 1 } });
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
        const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
        const trainerFilter = { role: 'entrenador' };
        if (!includeInactive) {
            trainerFilter.estado = 'activo';
        }
        const entrenadores = await User.find(trainerFilter);

        // Para simplificar, hacemos un "join" manual o usamos aggregate
        // Aquí recuperamos los alumnos de cada entrenador
        const reporte = await Promise.all(entrenadores.map(async (entrenador) => {
            const alumnoFilter = { entrenador: entrenador._id };
            if (!includeInactive) {
                alumnoFilter.estado = 'activo';
            }

            const alumnos = await Alumno.find(alumnoFilter).sort({ createdAt: -1 });
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
        const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
        if (req.query.estado) {
            filter.estado = req.query.estado;
        } else if (!includeInactive) {
            filter.estado = 'activo';
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
        const payload = { ...req.body };
        if (Array.isArray(payload.historialPagos)) {
            payload.historialPagos = payload.historialPagos.map((pago) => normalizePagoPeriodo(pago));
        }

        const nuevoAlumno = new Alumno(payload);
        if (!nuevoAlumno.periodosActividad || nuevoAlumno.periodosActividad.length === 0) {
            nuevoAlumno.periodosActividad = [{
                inicio: nuevoAlumno.fechaRegistro || new Date(),
                fin: null
            }];
        }
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
        const existingAlumno = await Alumno.findById(id);
        if (!existingAlumno) return res.status(404).json({ error: 'Alumno no encontrado' });

        if (req.body.estado === 'activo') {
            return res.status(400).json({ error: 'Usa la ruta de reactivacion para volver a habilitar un alumno.' });
        }

        if (existingAlumno.estado === 'inactivo' && req.body.estado !== 'activo') {
            const allowedFields = ['nombre', 'apellido', 'celular', 'entrenador'];
            const invalidField = Object.keys(req.body).find((key) => !allowedFields.includes(key));
            if (invalidField) {
                return res.status(400).json({ error: 'El alumno esta inactivo. Solo un administrador puede reactivarlo.' });
            }
        }

        const updated = await Alumno.findByIdAndUpdate(id, req.body, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DEACTIVATE Alumno
app.delete('/api/alumnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const actorRole = req.query.actorRole || null;
        const actorUserId = req.query.actorUserId || null;
        const alumno = await Alumno.findById(id);
        if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
        if (alumno.estado === 'inactivo') {
            return res.status(400).json({ error: 'El alumno ya esta inactivo' });
        }

        const periodosActividad = ensureAlumnoPeriodos(alumno);
        const periodoActivo = [...periodosActividad].reverse().find((periodo) => !periodo.fin);
        if (periodoActivo) {
            periodoActivo.fin = new Date();
        }

        alumno.estado = 'inactivo';
        alumno.fechaInactivacion = new Date();
        alumno.inactivatedBy = actorUserId || null;
        alumno.fechaReactivacion = null;
        alumno.reactivatedBy = null;
        await alumno.save();

        await removeAlumnoAssignments(alumno._id);

        res.json({
            message: actorRole === 'admin'
                ? 'Alumno desactivado correctamente'
                : 'Alumno pasado a inactivo correctamente',
            alumno
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/alumnos/:id/reactivar', async (req, res) => {
    try {
        const { id } = req.params;
        const { actorRole, actorUserId } = req.body;

        if (actorRole !== 'admin') {
            return res.status(403).json({ error: 'Solo un administrador puede reactivar alumnos.' });
        }

        const alumno = await Alumno.findById(id);
        if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

        ensureAlumnoPeriodos(alumno);

        alumno.estado = 'activo';
        alumno.fechaInactivacion = null;
        alumno.inactivatedBy = null;
        alumno.fechaReactivacion = new Date();
        alumno.reactivatedBy = actorUserId || null;
        alumno.periodosActividad.push({
            inicio: alumno.fechaReactivacion,
            fin: null
        });
        await alumno.save();

        res.json(alumno);
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

// --- HORARIO ROUTES ---

// GET All Horarios
app.get('/api/horarios', async (req, res) => {
    try {
        const horarios = await Horario.find()
            .populate('entrenadores', 'nombre')
            .populate('asignaciones.alumno', 'nombre apellido historialPagos');
        res.json(horarios);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE Horario
app.post('/api/horarios', async (req, res) => {
    try {
        const newHorario = new Horario(req.body);
        const saved = await newHorario.save();
        const populated = await Horario.findById(saved._id)
            .populate('entrenadores', 'nombre')
            .populate('asignaciones.alumno', 'nombre apellido historialPagos');
        res.status(201).json(populated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ENSURE Master Horario for Trainer
app.post('/api/horarios/ensure-master', async (req, res) => {
    try {
        const { entrenadorId } = req.body;
        if (!entrenadorId) return res.status(400).json({ error: 'Falta entrenadorId' });

        // Find existing master schedule for this trainer
        let masterHorario = await Horario.findOne({
            entrenadores: entrenadorId,
            dias: { $all: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] },
            horaInicio: 7,
            horaFin: 23
        });

        if (!masterHorario) {
            // Create a master schedule if none exists
            masterHorario = new Horario({
                nombre: `Horario Maestro - ${entrenadorId}`,
                horaInicio: 7,
                horaFin: 23,
                dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
                entrenadores: [entrenadorId]
            });
            await masterHorario.save();
        }

        const populated = await Horario.findById(masterHorario._id)
            .populate('entrenadores', 'nombre')
            .populate('asignaciones.alumno', 'nombre apellido historialPagos');

        res.status(200).json(populated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE Horario
app.put('/api/horarios/:id', async (req, res) => {
    try {
        // Cap entrenadores to max 3
        if (req.body.entrenadores && req.body.entrenadores.length > 3) {
            return res.status(400).json({ error: 'Máximo 3 entrenadores por horario' });
        }
        const updated = await Horario.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('entrenadores', 'nombre')
            .populate('asignaciones.alumno', 'nombre apellido historialPagos');
        if (!updated) return res.status(404).json({ error: 'Horario no encontrado' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE Horario
app.delete('/api/horarios/:id', async (req, res) => {
    try {
        await Horario.findByIdAndDelete(req.params.id);
        res.json({ message: 'Horario eliminado' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- ASIGNACION ROUTES ---

// Helper: get total weekly slots assigned to a student across ALL horarios
async function getTotalAsignacionesAlumno(alumnoId) {
    const horarios = await Horario.find({ 'asignaciones.alumno': alumnoId });
    let total = 0;
    horarios.forEach(h => {
        total += h.asignaciones.filter(a => a.alumno.toString() === alumnoId.toString()).length;
    });
    return total;
}

// Helper: get student's membership diasPorSemana
async function getDiasPermitidos(alumno) {
    if (!alumno.historialPagos || alumno.historialPagos.length === 0) return null;
    const lastPago = alumno.historialPagos[alumno.historialPagos.length - 1];
    if (!lastPago?.membresia) return null;

    let memb = null;
    // 1. Intentar por ID firme primero
    if (lastPago.membresia.id) {
        memb = await Membresia.findById(lastPago.membresia.id);
    }
    // 2. Fallback a búsqueda por nombre (Legacy)
    if (!memb && lastPago.membresia.nombre) {
        memb = await Membresia.findOne({ nombre: lastPago.membresia.nombre });
    }
    return memb?.diasPorSemana ?? null;
}

function getDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function findSameDayPago(alumno, fecha, excludedPagoId = null) {
    if (!alumno?.historialPagos?.length) return null;

    const targetKey = getDateKey(fecha);
    if (!targetKey) return null;

    return alumno.historialPagos.find((existingPago) => {
        if (excludedPagoId && existingPago._id?.toString() === excludedPagoId.toString()) {
            return false;
        }

        return getDateKey(existingPago.fecha) === targetKey;
    }) || null;
}

function normalizePagoPeriodo(pago, fallbackPago = null) {
    const normalizedPago = { ...pago };
    const fechaBase = normalizedPago.fecha ?? fallbackPago?.fecha ?? null;
    const parsedFecha = fechaBase ? new Date(fechaBase) : null;

    const mesCandidato = Number(normalizedPago.mesQueAbona ?? fallbackPago?.mesQueAbona);
    if (Number.isInteger(mesCandidato) && mesCandidato >= 1 && mesCandidato <= 12) {
        normalizedPago.mesQueAbona = mesCandidato;
    } else if (parsedFecha && !Number.isNaN(parsedFecha.getTime())) {
        normalizedPago.mesQueAbona = parsedFecha.getMonth() + 1;
    } else {
        normalizedPago.mesQueAbona = null;
    }

    const anioCandidato = Number(normalizedPago.anioQueAbona ?? fallbackPago?.anioQueAbona);
    if (Number.isInteger(anioCandidato) && anioCandidato > 2000) {
        normalizedPago.anioQueAbona = anioCandidato;
    } else {
        normalizedPago.anioQueAbona = new Date().getFullYear();
    }

    return normalizedPago;
}

// POST /api/horarios/:id/asignaciones — assign a student to a day+hour slot
app.post('/api/horarios/:id/asignaciones', async (req, res) => {
    try {
        const { alumnoId, dia, hora } = req.body;

        const horario = await Horario.findById(req.params.id);
        if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

        // Validate slot is within block's hours
        if (hora < horario.horaInicio || hora >= horario.horaFin) {
            return res.status(400).json({ error: `La hora ${hora} no está dentro del horario (${horario.horaInicio}-${horario.horaFin})` });
        }
        // Validate day is in block
        if (!horario.dias.includes(dia)) {
            return res.status(400).json({ error: `El día ${dia} no pertenece a este horario` });
        }
        // Validate student not already in this exact slot
        const yaAsignado = horario.asignaciones.some(
            a => a.alumno.toString() === alumnoId && a.dia === dia && a.hora === Number(hora)
        );
        if (yaAsignado) {
            return res.status(400).json({ error: 'El alumno ya está asignado a este turno' });
        }

        // Membership cap check
        const alumno = await Alumno.findById(alumnoId);
        if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
        if (alumno.estado !== 'activo') {
            return res.status(400).json({ error: 'No se puede asignar un alumno inactivo a un turno' });
        }

        const diasPermitidos = await getDiasPermitidos(alumno);
        if (diasPermitidos !== null) {
            const totalActual = await getTotalAsignacionesAlumno(alumnoId);
            if (totalActual >= diasPermitidos) {
                return res.status(400).json({
                    error: `El alumno ya alcanzó el límite de su membresía (${diasPermitidos} días/semana)`
                });
            }
        }

        // --- NUEVO LIMITE BASE ---
        const LIMITE_BASE = 7;
        const HARD_MAX_LIMIT = 10;

        let extraSpacesArray = horario.cuposExtra || [];
        let extraForSlot = extraSpacesArray.find(c => c.dia === dia && c.hora === Number(hora));
        let cantidadExtra = extraForSlot ? extraForSlot.cantidad : 0;

        // Sum total capacity, capped at max 10
        let LIMITE_ACTUAL = LIMITE_BASE + cantidadExtra;
        if (LIMITE_ACTUAL > HARD_MAX_LIMIT) LIMITE_ACTUAL = HARD_MAX_LIMIT;

        // Cuántos alumnos de ESTE bloque (profesor) ya están en este slot
        const misAlumnosEnTurno = horario.asignaciones.filter(a => a.dia === dia && a.hora === Number(hora)).length;

        if (misAlumnosEnTurno >= LIMITE_ACTUAL) {
            return res.status(400).json({
                error: `Cupo lleno: El maestro ya tiene ${misAlumnosEnTurno} alumnos. El máximo de este turno es ${LIMITE_ACTUAL}.`
            });
        }


        // Add assignment
        horario.asignaciones.push({ alumno: alumnoId, dia, hora: Number(hora) });
        await horario.save();

        const populated = await Horario.findById(horario._id)
            .populate('entrenadores', 'nombre')
            .populate('asignaciones.alumno', 'nombre apellido historialPagos');

        res.status(201).json(populated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/horarios/:id/asignaciones/:asignacionId — remove an assignment
app.delete('/api/horarios/:id/asignaciones/:asignacionId', async (req, res) => {
    try {
        const horario = await Horario.findById(req.params.id);
        if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

        const asignacionToBeRemoved = horario.asignaciones.find(
            a => a._id.toString() === req.params.asignacionId
        );

        if (!asignacionToBeRemoved) {
            return res.status(404).json({ error: 'Asignación no encontrada' });
        }

        // Decay the override space limit if it was expanded
        if (horario.cuposExtra) {
            const slotExtraIdx = horario.cuposExtra.findIndex(
                c => c.dia === asignacionToBeRemoved.dia && c.hora === asignacionToBeRemoved.hora
            );
            if (slotExtraIdx !== -1 && horario.cuposExtra[slotExtraIdx].cantidad > 0) {
                // Decay the extra slot counter by 1
                horario.cuposExtra[slotExtraIdx].cantidad -= 1;
            }
        }

        // Remove the student from the array
        horario.asignaciones = horario.asignaciones.filter(
            a => a._id.toString() !== req.params.asignacionId
        );
        await horario.save();

        const populated = await Horario.findById(horario._id)
            .populate('entrenadores', 'nombre')
            .populate('asignaciones.alumno', 'nombre apellido historialPagos');

        res.json(populated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/horarios/:id/cupo-extra — add an extra slot manually, caps at base + extra = 10
app.post('/api/horarios/:id/cupo-extra', async (req, res) => {
    try {
        const { dia, hora } = req.body;
        const horario = await Horario.findById(req.params.id);
        if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

        if (!horario.cuposExtra) {
            horario.cuposExtra = [];
        }

        const slotExtraIdx = horario.cuposExtra.findIndex(c => c.dia === dia && c.hora === Number(hora));
        const LIMITE_BASE = 7;
        const HARD_MAX_LIMIT = 10;

        if (slotExtraIdx !== -1) {
            const extraActual = horario.cuposExtra[slotExtraIdx].cantidad;
            if (LIMITE_BASE + extraActual >= HARD_MAX_LIMIT) {
                return res.status(400).json({ error: `No se puede exceder el límite duro total de ${HARD_MAX_LIMIT} alumnos.` });
            }
            horario.cuposExtra[slotExtraIdx].cantidad += 1;
        } else {
            horario.cuposExtra.push({ dia, hora: Number(hora), cantidad: 1 });
        }

        await horario.save();
        res.json({ message: 'Cupo extra añadido exitosamente', cuposExtra: horario.cuposExtra });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/alumnos/:id/asignaciones — get student's weekly slot count + limit
app.get('/api/alumnos/:id/asignaciones', async (req, res) => {
    try {
        const alumno = await Alumno.findById(req.params.id);
        if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
        if (alumno.estado !== 'activo') {
            return res.status(400).json({ error: 'El alumno esta inactivo' });
        }

        const total = await getTotalAsignacionesAlumno(req.params.id);
        const diasPermitidos = await getDiasPermitidos(alumno);

        res.json({ total, diasPermitidos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/horarios/limits/slots — get limits metadata (using new flat limit schema)
app.get('/api/horarios/limits/slots', async (req, res) => {
    try {
        const horarios = await Horario.find();
        const slotData = {}; // En este nuevo modelo enviaremos las reglas exactas por bloque

        horarios.forEach(h => {
            const hId = h._id.toString();

            // Recompilar cuántos lugares extra se concedieron para cada slot en este master block
            const extrasMap = {};
            if (h.cuposExtra) {
                h.cuposExtra.forEach(cx => {
                    extrasMap[`${cx.dia}-${cx.hora}`] = cx.cantidad;
                });
            }

            // Repasar todas las celdas de tiempo del bloque para enviar el límite
            h.dias.forEach(d => {
                for (let hr = h.horaInicio; hr < h.horaFin; hr++) {
                    const key = `${d}-${hr}`;
                    if (!slotData[key]) slotData[key] = { blocksLimits: {} };

                    // Base = 7, si hay extras sumarlos (hasta max 10)
                    const extraAdded = extrasMap[key] || 0;
                    let blockLimit = 7 + extraAdded;
                    if (blockLimit > 10) blockLimit = 10;

                    slotData[key].blocksLimits[hId] = blockLimit;
                }
            });
        });

        res.json(slotData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADD Payment
app.post('/api/alumnos/:id/pagos', async (req, res) => {
    try {
        const { id } = req.params;
        const { allowDuplicateSameDay, ...pagoPayload } = req.body;
        const alumnoExistente = await Alumno.findById(id);

        if (!alumnoExistente) return res.status(404).json({ error: 'Alumno no encontrado' });
        if (alumnoExistente.estado !== 'activo') {
            return res.status(400).json({ error: 'No se pueden registrar pagos en un alumno inactivo. Reactivalo primero.' });
        }

        const pago = normalizePagoPeriodo(pagoPayload);
        const sameDayPago = findSameDayPago(alumnoExistente, pago.fecha);
        if (sameDayPago && !allowDuplicateSameDay) {
            return res.status(409).json({
                error: 'El alumno ya tiene un pago registrado en esa fecha.',
                code: 'DUPLICATE_PAYMENT_SAME_DAY',
                existingPagoId: sameDayPago._id,
                existingPagoDate: sameDayPago.fecha
            });
        }

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

app.put('/api/alumnos/:id/pagos/:pagoId', async (req, res) => {
    try {
        const { id, pagoId } = req.params;
        const alumno = await Alumno.findById(id);

        if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
        if (alumno.estado !== 'activo') {
            return res.status(400).json({ error: 'No se pueden editar pagos de un alumno inactivo. Reactivalo primero.' });
        }

        const pago = alumno.historialPagos.id(pagoId);
        if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

        const normalizedPayload = normalizePagoPeriodo(req.body, pago);
        const fechaObjetivo = normalizedPayload.fecha ?? pago.fecha;
        const sameDayPago = findSameDayPago(alumno, fechaObjetivo, pagoId);
        if (sameDayPago && !req.body.allowDuplicateSameDay) {
            return res.status(409).json({
                error: 'El alumno ya tiene otro pago registrado en esa fecha.',
                code: 'DUPLICATE_PAYMENT_SAME_DAY',
                existingPagoId: sameDayPago._id,
                existingPagoDate: sameDayPago.fecha
            });
        }

        const allowedFields = [
            'fecha',
            'mesQueAbona',
            'anioQueAbona',
            'tipo',
            'detalle',
            'medio',
            'monto',
            'montoInformado',
            'membresia',
            'esParcial',
            'completaParcial',
            'montoObjetivo',
            'saldoPendiente'
        ];

        allowedFields.forEach((field) => {
            if (normalizedPayload[field] !== undefined) {
                pago[field] = normalizedPayload[field];
            }
        });

        await alumno.save();
        res.json(alumno);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/alumnos/:id/pagos/:pagoId', async (req, res) => {
    try {
        const { id, pagoId } = req.params;
        const alumno = await Alumno.findById(id);

        if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });

        const pago = alumno.historialPagos.id(pagoId);
        if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

        pago.deleteOne();
        await alumno.save();

        res.json(alumno);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- EXPENSE ROUTES ---

app.get('/api/expenses', async (req, res) => {
    try {
        const filter = {};
        const month = Number(req.query.month);
        const year = Number(req.query.year);

        if (Number.isInteger(month) && Number.isInteger(year) && month >= 1 && month <= 12) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 1);

            filter.fecha = {
                $gte: start,
                $lt: end
            };
        }

        const expenses = await Expense.find(filter).sort({ fecha: -1, createdAt: -1 });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/expenses', async (req, res) => {
    try {
        const { detalle, monto, fecha } = req.body;

        const newExpense = new Expense({
            detalle,
            monto,
            fecha
        });

        const savedExpense = await newExpense.save();
        res.status(201).json(savedExpense);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
        if (!deletedExpense) {
            return res.status(404).json({ error: 'Gasto no encontrado' });
        }

        res.json({ message: 'Gasto eliminado correctamente' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});


// --- RBAC MIDDLEWARE HELPER ---
function requireRole(allowedRoles) {
    return (req, res, next) => {
        const role = (
            req.headers['x-user-role'] ||
            req.body.actorRole ||
            req.body.userRole ||
            req.query.actorRole ||
            ''
        ).toString().toUpperCase();

        const allowed = allowedRoles.map(r => r.toUpperCase());

        if (!role || !allowed.includes(role)) {
            return res.status(403).json({
                error: `Acceso restringido. Se requiere rol: ${allowedRoles.join(' o ')}`
            });
        }
        next();
    };
}

// --- PRODUCT ROUTES ---

// GET All Products (supporting barcode & text search)
app.get('/api/products', async (req, res) => {
    try {
        const { codigoBarras, search, category, activeOnly } = req.query;
        const filter = {};

        if (codigoBarras) {
            filter.codigoBarras = codigoBarras;
        }

        if (search) {
            filter.$or = [
                { nombre: { $regex: search, $options: 'i' } },
                { codigoBarras: { $regex: search, $options: 'i' } },
                { categoria: { $regex: search, $options: 'i' } }
            ];
        }

        if (category) {
            filter.categoria = category;
        }

        if (activeOnly === 'true') {
            filter.activo = true;
        }

        const products = await Product.find(filter).sort({ nombre: 1, name: 1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Product by ID or Barcode
app.get('/api/products/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        let product = null;

        // Try exact barcode match first
        product = await Product.findOne({ codigoBarras: query });

        if (!product && mongoose.Types.ObjectId.isValid(query)) {
            product = await Product.findById(query);
        }

        if (!product) {
            product = await Product.findOne({ nombre: { $regex: query, $options: 'i' } });
        }

        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE Product (Allowed ONLY for ADMIN_VENTAS or ADMIN)
app.post('/api/products', requireRole(['ADMIN_VENTAS', 'ADMIN', 'admin']), async (req, res) => {
    try {
        const {
            nombre, name,
            codigoBarras,
            descripcion,
            precioVenta, price,
            precioCosto,
            stockActual, stock,
            stockMinimo,
            categoria, category,
            activo
        } = req.body;

        const newProduct = new Product({
            nombre: nombre || name,
            codigoBarras: codigoBarras || null,
            descripcion: descripcion || '',
            precioVenta: precioVenta !== undefined ? precioVenta : (price || 0),
            precioCosto: precioCosto !== undefined ? precioCosto : 0,
            stockActual: stockActual !== undefined ? stockActual : (stock || 0),
            stockMinimo: stockMinimo !== undefined ? stockMinimo : 5,
            categoria: categoria || category || 'General',
            activo: activo !== undefined ? activo : true
        });

        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE Product (Allowed ONLY for ADMIN_VENTAS or ADMIN)
app.put('/api/products/:id', requireRole(['ADMIN_VENTAS', 'ADMIN', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if (updateData.name && !updateData.nombre) updateData.nombre = updateData.name;
        if (updateData.price && !updateData.precioVenta) updateData.precioVenta = updateData.price;
        if (updateData.stock && updateData.stockActual === undefined) updateData.stockActual = updateData.stock;

        const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!updatedProduct) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ADJUST STOCK (Allowed for ALL authenticated users, requiring 'razon')
app.post('/api/products/:id/adjust-stock', async (req, res) => {
    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (e) {
        session = null;
    }

    try {
        const { id } = req.params;
        const {
            cantidadNueva, newStock,
            cantidadCambio, change,
            razon,
            usuarioId, actorUserId, seller,
            tipoMovimiento
        } = req.body;

        if (!razon || !String(razon).trim()) {
            if (session) await session.abortTransaction();
            return res.status(400).json({ error: 'El campo razon es obligatorio para registrar la trazabilidad' });
        }

        const product = await Product.findById(id).session(session || null);
        if (!product) {
            if (session) await session.abortTransaction();
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const previousStock = product.stockActual;
        let targetStock = previousStock;

        if (cantidadNueva !== undefined) {
            targetStock = Number(cantidadNueva);
        } else if (newStock !== undefined) {
            targetStock = Number(newStock);
        } else if (cantidadCambio !== undefined) {
            targetStock = previousStock + Number(cantidadCambio);
        } else if (change !== undefined) {
            targetStock = previousStock + Number(change);
        }

        const actualDelta = targetStock - previousStock;
        product.stockActual = targetStock;
        await product.save({ session: session || undefined });

        const userIdToUse = usuarioId || actorUserId || seller || req.headers['x-user-id'] || product._id;
        const movementType = tipoMovimiento || (actualDelta >= 0 ? 'ENTRADA' : 'AJUSTE_MANUAL');

        const movement = new StockMovement({
            productoId: product._id,
            usuarioId: userIdToUse,
            tipoMovimiento: movementType,
            cantidadAnterior: previousStock,
            cantidadCambio: actualDelta,
            cantidadNueva: targetStock,
            razon: String(razon).trim()
        });

        await movement.save({ session: session || undefined });

        // Backward compatibility log
        const log = new StockLog({
            product: id,
            previousStock,
            newStock: targetStock,
            change: actualDelta,
            reason: String(razon).trim()
        });
        await log.save({ session: session || undefined });

        if (session) await session.commitTransaction();

        res.json({ message: 'Stock actualizado correctamente', product, movement, log });
    } catch (err) {
        if (session) await session.abortTransaction();
        res.status(400).json({ error: err.message });
    } finally {
        if (session) session.endSession();
    }
});

// GET Product Stock Movements
app.get('/api/products/:id/stock-movements', async (req, res) => {
    try {
        const { id } = req.params;
        const movements = await StockMovement.find({ productoId: id })
            .populate('usuarioId', 'nombre username role')
            .sort({ fechaHora: -1 });
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Legacy Stock Logs
app.get('/api/products/:id/stock-logs', async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await StockLog.find({ product: id }).sort({ date: -1 }).limit(10);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE Product
app.delete('/api/products/:id', requireRole(['ADMIN_VENTAS', 'ADMIN', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Product.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ error: 'Producto no encontrado' });

        res.json({ message: 'Producto eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SALES / POS ROUTES ---

// CREATE Sale (Atomic Transaction with Stock validation & StockMovement trace)
app.post('/api/sales', async (req, res) => {
    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (e) {
        session = null;
    }

    try {
        const { items, total, metodoPago, usuarioId, seller, actorUserId } = req.body;
        const userIdToRecord = usuarioId || seller || actorUserId || req.headers['x-user-id'];

        if (!items || !Array.isArray(items) || items.length === 0) {
            if (session) await session.abortTransaction();
            return res.status(400).json({ error: 'La venta debe incluir al menos un producto' });
        }

        const processedItems = [];
        const stockMovementsToCreate = [];
        let calculatedTotal = 0;

        for (const item of items) {
            const productId = item.productoId || item.product || item._id;
            const quantity = Number(item.cantidad || item.quantity || 1);

            if (!productId) {
                if (session) await session.abortTransaction();
                return res.status(400).json({ error: 'Cada ítem debe incluir la referencia del producto' });
            }

            const product = await Product.findById(productId).session(session || null);
            if (!product) {
                if (session) await session.abortTransaction();
                return res.status(404).json({ error: `Producto no encontrado (ID: ${productId})` });
            }

            if (product.stockActual < quantity) {
                if (session) await session.abortTransaction();
                return res.status(400).json({
                    error: `Stock insuficiente para "${product.nombre}". Disponible: ${product.stockActual}, Solicitado: ${quantity}`
                });
            }

            const unitPrice = Number(item.precioUnitario !== undefined ? item.precioUnitario : (item.price || product.precioVenta));
            const subtotal = unitPrice * quantity;
            calculatedTotal += subtotal;

            const previousStock = product.stockActual;
            const newStock = previousStock - quantity;

            // Reduce stock atomically
            product.stockActual = newStock;
            await product.save({ session: session || undefined });

            processedItems.push({
                productoId: product._id,
                nombre: product.nombre,
                cantidad: quantity,
                precioUnitario: unitPrice,
                subtotal: subtotal
            });

            stockMovementsToCreate.push({
                productoId: product._id,
                usuarioId: userIdToRecord || product._id,
                tipoMovimiento: 'SALIDA_VENTA',
                cantidadAnterior: previousStock,
                cantidadCambio: -quantity,
                cantidadNueva: newStock,
                razon: 'Venta POS'
            });
        }

        const finalTotal = total !== undefined ? Number(total) : calculatedTotal;

        const newSale = new Sale({
            items: processedItems,
            total: finalTotal,
            metodoPago: metodoPago || 'EFECTIVO',
            usuarioId: userIdToRecord || null,
            fechaHora: new Date()
        });

        const savedSale = await newSale.save({ session: session || undefined });

        for (const movementData of stockMovementsToCreate) {
            movementData.razon = `Venta POS #${savedSale._id}`;
            const movement = new StockMovement(movementData);
            await movement.save({ session: session || undefined });
        }

        if (session) await session.commitTransaction();

        res.status(201).json(savedSale);
    } catch (err) {
        if (session) await session.abortTransaction();
        res.status(400).json({ error: err.message });
    } finally {
        if (session) session.endSession();
    }
});

// GET Recent Sales
app.get('/api/sales', async (req, res) => {
    try {
        const sales = await Sale.find()
            .populate('usuarioId', 'nombre apellido username role')
            .populate('seller', 'nombre apellido')
            .sort({ fechaHora: -1, date: -1 })
            .limit(50);
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

        const filter = {
            $or: [
                { "items.productoId": id },
                { "items.product": id }
            ]
        };
        if (sellerId) {
            filter.$or.forEach(f => f.usuarioId = sellerId);
        }

        const sales = await Sale.find(filter)
            .populate('usuarioId', 'nombre apellido')
            .populate('seller', 'nombre apellido')
            .sort({ fechaHora: -1, date: -1 });

        let totalSold = 0;
        const salesByTrainer = {};
        const salesLog = [];

        sales.forEach(sale => {
            const item = sale.items.find(i => (i.productoId?.toString() === id || i.product?.toString() === id));
            if (item) {
                totalSold += item.cantidad || item.quantity || 0;
                const sellerObj = sale.usuarioId || sale.seller;
                const trainerName = sellerObj
                    ? `${sellerObj.nombre || ''} ${sellerObj.apellido || ''}`.trim()
                    : 'Desconocido/Admin';

                if (!salesByTrainer[trainerName]) {
                    salesByTrainer[trainerName] = 0;
                }
                salesByTrainer[trainerName] += item.cantidad || item.quantity || 0;

                salesLog.push({
                    _id: sale._id,
                    date: sale.fechaHora || sale.date,
                    sellerName: trainerName,
                    quantity: item.cantidad || item.quantity,
                    amount: (item.precioUnitario || item.price) * (item.cantidad || item.quantity)
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
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            filter.fechaHora = { $gte: start, $lte: end };
        }

        const sales = await Sale.find(filter)
            .populate('usuarioId', 'nombre apellido')
            .populate('seller', 'nombre apellido');

        const statsBySeller = {};
        let totalRevenue = 0;
        let totalSalesCount = 0;

        sales.forEach(sale => {
            const seller = sale.usuarioId || sale.seller;
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

            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(item => {
                    const pName = item.nombre || item.name || 'Producto Desconocido';
                    if (!statsBySeller[sellerName].products[pName]) {
                        statsBySeller[sellerName].products[pName] = { count: 0, revenue: 0 };
                    }
                    const cant = item.cantidad || item.quantity || 0;
                    const price = item.precioUnitario || item.price || 0;
                    statsBySeller[sellerName].products[pName].count += cant;
                    statsBySeller[sellerName].products[pName].revenue += (price * cant);
                });
            }

            totalSalesCount += 1;
            totalRevenue += sale.total;
        });

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
