const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

const APPLY_MODE = process.argv.includes('--apply');

const SKIP_PAYMENT_IDS = new Set([
    // Jorge Elias: pago a revisar manualmente antes de asignarle periodo.
    '69e66d067148199a8377bb6c'
]);

const PagoSchema = new mongoose.Schema({
    fecha: { type: Date, required: true },
    mesQueAbona: { type: Number, min: 1, max: 12, default: null },
    anioQueAbona: { type: Number, default: null },
    tipo: { type: String, required: true },
    detalle: { type: String, default: '' },
    medio: { type: String, default: '' },
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
    clientCreatedAt: { type: Date, default: null }
}, { timestamps: true });

const AlumnoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    apellido: { type: String, required: true },
    historialPagos: [PagoSchema]
}, { strict: false });

const Alumno = mongoose.model('Alumno', AlumnoSchema);

function comparePagosAsc(a, b) {
    const fechaDiff = new Date(a.fecha) - new Date(b.fecha);
    if (fechaDiff !== 0) return fechaDiff;

    const createdDiff = new Date(a.createdAt || a.clientCreatedAt || 0) - new Date(b.createdAt || b.clientCreatedAt || 0);
    if (createdDiff !== 0) return createdDiff;

    if (a.esParcial && !b.esParcial) return -1;
    if (b.esParcial && !a.esParcial) return 1;
    if (a.completaParcial && !b.completaParcial) return 1;
    if (b.completaParcial && !a.completaParcial) return -1;

    return 0;
}

function isPromisePayment(pago) {
    const normalized = String(pago?.tipo || pago?.detalle || '').trim().toLowerCase();
    return normalized === 'promesa de pago' || normalized === 'promesa_pago';
}

function formatPeriodo(month, year) {
    return `${String(month).padStart(2, '0')}/${year}`;
}

function nextPeriodo(periodo) {
    const nextMonth = periodo.month === 12 ? 1 : periodo.month + 1;
    const nextYear = periodo.month === 12 ? periodo.year + 1 : periodo.year;
    return { month: nextMonth, year: nextYear };
}

function getMonto(pago) {
    if (typeof pago?.monto === 'number') return pago.monto;
    return Number(pago?.monto || pago?.membresia?.precio || 0);
}

function assignPeriodsForAlumno(alumno) {
    const pagos = [...(alumno.historialPagos || [])].sort(comparePagosAsc);
    const preview = [];

    let currentPeriodo = null;

    for (const pago of pagos) {
        const pagoId = String(pago._id);
        const fechaPago = new Date(pago.fecha);
        const skipped = SKIP_PAYMENT_IDS.has(pagoId);

        if (skipped) {
            preview.push({
                pagoId,
                fecha: pago.fecha,
                tipo: pago.tipo,
                detalle: pago.detalle || '',
                monto: getMonto(pago),
                skipped: true,
                reason: 'Pago excluido manualmente'
            });
            continue;
        }

        if (!currentPeriodo) {
            currentPeriodo = {
                month: fechaPago.getMonth() + 1,
                year: fechaPago.getFullYear()
            };
        }

        pago.mesQueAbona = currentPeriodo.month;
        pago.anioQueAbona = currentPeriodo.year;

        preview.push({
            pagoId,
            fecha: pago.fecha,
            tipo: pago.tipo,
            detalle: pago.detalle || '',
            monto: getMonto(pago),
            periodo: formatPeriodo(currentPeriodo.month, currentPeriodo.year),
            skipped: false
        });

        const advancesPeriod = !pago.esParcial && !isPromisePayment(pago);
        if (advancesPeriod) {
            currentPeriodo = nextPeriodo(currentPeriodo);
        }
    }

    return {
        pagos,
        preview
    };
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);

    const alumnos = await Alumno.find({ 'historialPagos.0': { $exists: true } });
    let alumnosUpdated = 0;
    let pagosAssigned = 0;
    let pagosSkipped = 0;

    console.log(APPLY_MODE ? 'Aplicando migracion de periodos de pago...' : 'Preview de migracion de periodos de pago...');
    console.log(`Pagos excluidos manualmente: ${Array.from(SKIP_PAYMENT_IDS).join(', ') || 'ninguno'}`);

    for (const alumno of alumnos) {
        const { preview } = assignPeriodsForAlumno(alumno);
        const pagosConPeriodo = preview.filter((item) => !item.skipped);
        const pagosSaltados = preview.filter((item) => item.skipped);

        if (pagosConPeriodo.length === 0 && pagosSaltados.length === 0) {
            continue;
        }

        alumnosUpdated += 1;
        pagosAssigned += pagosConPeriodo.length;
        pagosSkipped += pagosSaltados.length;

        const alumnoNombre = `${alumno.nombre || ''} ${alumno.apellido || ''}`.trim();
        console.log(`\n${alumnoNombre}`);

        preview.forEach((item) => {
            if (item.skipped) {
                console.log(`  - ${item.fecha.toISOString().slice(0, 10)} | ${item.tipo || '-'} | $${item.monto} | SKIP (${item.reason})`);
                return;
            }

            console.log(`  - ${item.fecha.toISOString().slice(0, 10)} | ${item.tipo || '-'} | $${item.monto} | ${item.periodo}`);
        });

        if (APPLY_MODE) {
            await alumno.save();
        }
    }

    console.log('\nResumen');
    console.log(`- Alumnos revisados: ${alumnosUpdated}`);
    console.log(`- Pagos con periodo asignado: ${pagosAssigned}`);
    console.log(`- Pagos saltados manualmente: ${pagosSkipped}`);
    console.log(`- Modo: ${APPLY_MODE ? 'APPLY' : 'PREVIEW'}`);
}

main()
    .then(async () => {
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error('Error en migracion de periodos:', err);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    });
