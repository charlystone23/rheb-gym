const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ quiet: true });
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
    role: { type: String, enum: ['admin', 'entrenador'], default: 'entrenador' },
    nombre: { type: String },
    linkedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedTrainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
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
    tipo: { type: String, required: true }, // 'efectivo', 'transferencia', 'otros'
    membresia: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Membresia' },
        nombre: { type: String },
        precio: { type: Number }
    },
    monto: { type: Number }
});

const AlumnoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    celular: { type: String, required: false },
    fechaRegistro: { type: Date, default: Date.now },
    estado: { type: String, default: 'activo' },
    historialPagos: [PagoSchema],
    entrenador: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Link al entrenador
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Alumno = mongoose.model('Alumno', AlumnoSchema);
const Rutina = mongoose.model('Rutina', RutinaSchema);
const Membresia = mongoose.model('Membresia', MembresiaSchema);
const Horario = mongoose.model('Horario', HorarioSchema);

function sanitizeUser(user) {
    if (!user) return null;

    return {
        _id: user._id,
        username: user.username,
        role: user.role,
        nombre: user.nombre,
        linkedAdminId: user.linkedAdmin?._id || user.linkedAdmin || null,
        linkedTrainerId: user.linkedTrainer?._id || user.linkedTrainer || null
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

        const user = await User.findByIdAndUpdate(id, updateData, { new: true });

        res.json(sanitizeUser(user));
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
