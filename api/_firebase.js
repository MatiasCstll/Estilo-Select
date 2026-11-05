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

const claveStock = (color, talle) => (color || '-') + '|' + talle;

module.exports = { admin, db, configTienda, claveStock };
