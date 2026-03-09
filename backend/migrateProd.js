const mongoose = require('mongoose');

const url = 'mongodb+srv://carlitos007leal_db_user:MZspt59gzUFU04v7@cluster0.ntahlht.mongodb.net/rheb_gym?retryWrites=true&w=majority&appName=Cluster0';

async function migrate() {
    try {
        await mongoose.connect(url);
        console.log("Connected to PROD db");

        const AlumnoSchema = new mongoose.Schema({}, { strict: false });
        // Use 'alumnos' collection
        const Alumno = mongoose.model('Alumno', AlumnoSchema, 'alumnos');

        const MembresiaSchema = new mongoose.Schema({ nombre: String }, { strict: false });
        const Membresia = mongoose.model('Membresia', MembresiaSchema, 'membresias');

        const mems = await Membresia.find({});
        const map = {};
        mems.forEach(m => map[m.nombre] = m._id);

        const alumnos = await Alumno.find({});
        let modified = 0;

        for (let a of alumnos) {
            let changed = false;
            const historial = a.get('historialPagos');
            if (historial && Array.isArray(historial)) {
                for (let p of historial) {
                    if (p.membresia && p.membresia.nombre && !p.membresia.id && map[p.membresia.nombre]) {
                        p.membresia.id = map[p.membresia.nombre];
                        changed = true;
                    }
                }
            }
            if (changed) {
                // Update only that field to bypass complex validation if needed
                await Alumno.updateOne({ _id: a._id }, { $set: { historialPagos: historial } });
                modified++;
            }
        }
        console.log('Modified', modified, 'students to link IDs in PRODUCTION');
    } catch (err) {
        console.error("Migration error:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrate();
