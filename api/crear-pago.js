// POST /api/crear-pago  { pedidoId }
// Recalcula el pedido con los precios reales, crea el pago en Mercado Pago
// y devuelve el link para que la clienta pague.
const { admin, db, configTienda, claveStock } = require('./_firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    // 1) ¿Quién es? (token de Firebase que manda la tienda)
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Tenés que iniciar sesión.' });
    const user = await admin.auth().verifyIdToken(token);

    const { pedidoId } = req.body || {};
    if (!pedidoId) return res.status(400).json({ error: 'Falta el pedido.' });

    const ref = db.collection('pedidos').doc(String(pedidoId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'No encontramos el pedido.' });
    const pedido = snap.data();
    if (pedido.uid !== user.uid) return res.status(403).json({ error: 'Este pedido no es tuyo.' });
    if (pedido.estado !== 'pendiente') return res.status(400).json({ error: 'Este pedido ya fue pagado o cancelado.' });

    // 2) Recalcular precios y stock desde la base (no confiamos en lo que manda el navegador)
    const items = [];
    for (const it of pedido.items || []) {
      const pSnap = await db.collection('productos').doc(it.pid).get();
      if (!pSnap.exists) return res.status(400).json({ error: `"${it.nombre}" ya no está disponible.` });
      const p = pSnap.data();
      if (p.activo === false) return res.status(400).json({ error: `"${p.nombre}" ya no está disponible.` });
      const k = claveStock(it.color, it.talle);
      if (p.stock && k in p.stock && Number(p.stock[k]) < it.cant)
        return res.status(400).json({ error: `No queda stock suficiente de "${p.nombre}" (${it.color || ''} ${it.talle}).` });
      const cant = Math.max(1, Math.min(50, parseInt(it.cant, 10) || 1));
      items.push({ pid: it.pid, nombre: p.nombre, precio: Number(p.precio), color: it.color || null, talle: it.talle, cant });
    }
    if (!items.length) return res.status(400).json({ error: 'El pedido está vacío.' });

    const cfg = await configTienda();
    const subtotal = items.reduce((s, i) => s + i.precio * i.cant, 0);
    let envio = 0;
    if (pedido.entrega && pedido.entrega.tipo === 'envio')
      envio = (cfg.envioGratisDesde && subtotal >= cfg.envioGratisDesde) ? 0 : Number(cfg.costoEnvio) || 0;
    const total = subtotal + envio;

    // 3) Crear la preferencia de pago en Mercado Pago
    const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    const mpItems = items.map(i => ({
      id: i.pid,
      title: `${i.nombre}${i.color ? ' - ' + i.color : ''} - Talle ${i.talle}`.slice(0, 250),
      quantity: i.cant,
      unit_price: i.precio,
      currency_id: 'ARS'
    }));
    if (envio) mpItems.push({ id: 'envio', title: 'Envío a domicilio', quantity: 1, unit_price: envio, currency_id: 'ARS' });

    const pref = {
      items: mpItems,
      payer: { name: pedido.cliente?.nombre, email: pedido.cliente?.email },
      external_reference: snap.id,
      back_urls: {
        success: `${site}/?pago=ok&pedido=${snap.id}`,
        pending: `${site}/?pago=pendiente&pedido=${snap.id}`,
        failure: `${site}/?pago=error&pedido=${snap.id}`
      },
      auto_return: 'approved',
      notification_url: `${site}/api/webhook-mp`,
      statement_descriptor: 'ESTILO SELECT'
    };
    if (cfg.cuotasSinInteres > 1) pref.payment_methods = { installments: 12 };

    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      body: JSON.stringify(pref)
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Mercado Pago respondió error', r.status, data);
      return res.status(502).json({ error: 'Mercado Pago no respondió bien. Probá de nuevo en un momento.' });
    }

    await ref.update({ items, subtotal, envio, total, preferenciaId: data.id, actualizado: admin.firestore.FieldValue.serverTimestamp() });
    return res.status(200).json({ url: data.init_point });
  } catch (e) {
    console.error(e);
    const auth = String(e.code || '').startsWith('auth/');
    return res.status(auth ? 401 : 500).json({ error: auth ? 'Tu sesión venció. Volvé a ingresar.' : 'Error del servidor. Probá de nuevo.' });
  }
};
