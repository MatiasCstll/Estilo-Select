// Conexión del servidor con Firebase (usa la cuenta de servicio guardada en Vercel).
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta la variable FIREBASE_SERVICE_ACCOUNT en Vercel.');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

const db = admin.firestore();

const CONFIG_DEFAULT = { costoEnvio: 4500, envioGratisDesde: 80000 };

async function configTienda() {
  const d = await db.collection('config').doc('tienda').get();
  return { ...CONFIG_DEFAULT, ...(d.exists ? d.data() : {}) };
}

async function cuponPorCodigo(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) return null;
  const d = await db.collection('cupones').doc(c).get();
  return d.exists ? { codigo: c, ...d.data() } : null;
}

// Devuelve { descuento, error } para un cupón y un subtotal
function calcularCupon(cup, subtotal, hoy) {
  if (!cup || cup.activo === false) return { descuento: 0, error: 'Ese cupón no existe o ya no está activo.' };
  const d = hoy || new Date().toISOString().slice(0, 10);
  if (cup.vence && d > cup.vence) return { descuento: 0, error: 'Ese cupón ya venció.' };
  if (cup.minimo && subtotal < Number(cup.minimo)) return { descuento: 0, error: 'Ese cupón es para compras desde $' + Number(cup.minimo).toLocaleString('es-AR') + '.' };
  const v = Number(cup.valor) || 0;
  const desc = cup.tipo === 'monto' ? v : Math.round(subtotal * Math.min(100, v) / 100);
  return { descuento: Math.max(0, Math.min(subtotal, Math.round(desc))), error: null };
}

const claveStock = (color, talle) => (color || '-') + '|' + talle;

module.exports = { admin, db, configTienda, claveStock, cuponPorCodigo, calcularCupon };
