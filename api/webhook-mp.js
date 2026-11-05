// POST /api/webhook-mp — Mercado Pago avisa acá cuando cambia un pago.
// Consultamos el pago directamente a Mercado Pago (no confiamos en el aviso),
// marcamos el pedido como pagado y descontamos el stock una sola vez.
const crypto = require('crypto');
const { admin, db, claveStock } = require('./_firebase');

function firmaValida(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;                       // opcional: si no está configurada, se saltea
  const sig = req.headers['x-signature'] || '';
  const reqId = req.headers['x-request-id'] || '';
  const partes = Object.fromEntries(sig.split(',').map(p => p.trim().split('=')));
  if (!partes.ts || !partes.v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${partes.ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(partes.v1)); } catch { return false; }
}

module.exports = async (req, res) => {
  try {
    const q = req.query || {}, b = req.body || {};
    const tipo = b.type || q.type || q.topic;
    const pagoId = (b.data && b.data.id) || q['data.id'] || q.id;
    if (tipo !== 'payment' || !pagoId) return res.status(200).send('ignorado');
    if (!firmaValida(req, pagoId)) return res.status(401).send('firma inválida');

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(pagoId)}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    if (!r.ok) { console.error('No se pudo leer el pago', pagoId, r.status); return res.status(200).send('ok'); }
    const pago = await r.json();
    const pedidoId = pago.external_reference;
    if (!pedidoId) return res.status(200).send('sin pedido');

    const ref = db.collection('pedidos').doc(String(pedidoId));
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const pedido = snap.data();
      const cambios = { pagoId: String(pago.id), pagoEstado: pago.status, pagoDetalle: pago.status_detail || null, actualizado: admin.firestore.FieldValue.serverTimestamp() };

      if (pago.status === 'approved') {
        // Control: lo cobrado tiene que coincidir con el total del pedido
        if (Math.abs(Number(pago.transaction_amount) - Number(pedido.total)) > 1) cambios.alertaMonto = `Cobrado ${pago.transaction_amount} vs pedido ${pedido.total}`;
        if (pedido.estado === 'pendiente') cambios.estado = 'pagado';
        if (!pedido.stockDescontado) {
          const refsProd = [...new Set(pedido.items.map(i => i.pid))].map(id => db.collection('productos').doc(id));
          const prods = await Promise.all(refsProd.map(rf => tx.get(rf)));
          prods.forEach((ps, idx) => {
            if (!ps.exists) return;
            const stock = { ...(ps.data().stock || {}) };
            pedido.items.filter(i => i.pid === ps.id).forEach(i => {
              const k = claveStock(i.color, i.talle);
              if (k in stock) {
                const nuevo = Number(stock[k]) - i.cant;
                if (nuevo < 0) cambios.alertaStock = true;
                stock[k] = Math.max(0, nuevo);
              }
            });
            tx.update(refsProd[idx], { stock });
          });
          cambios.stockDescontado = true;
        }
      } else if (['refunded', 'charged_back'].includes(pago.status)) {
        cambios.estado = 'cancelado';
      }
      tx.update(ref, cambios);
    });
    return res.status(200).send('ok');
  } catch (e) {
    console.error(e);
    return res.status(500).send('error');     // Mercado Pago reintenta más tarde
  }
};
