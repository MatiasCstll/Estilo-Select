/* ============================================================
   ESTILO SELECT — Capa de datos
   Habla con Firebase (Auth + Firestore) o, si no está configurado,
   guarda todo en el navegador (MODO DEMO).
   La tienda y el panel admin solo usan las funciones de DB.*
   ============================================================ */
(function () {
  const CFG = window.ES_CONFIG || {};
  const usarFirebase = !!(CFG.firebase && CFG.firebase.apiKey && typeof firebase !== 'undefined');

  // ── Productos de ejemplo (se cargan la primera vez) ───────────
  const C = (nombre, hex) => ({ nombre, hex });
  const stockDe = (colores, talles, n) => {
    const s = {};
    (colores.length ? colores : [{ nombre: '-' }]).forEach(c =>
      talles.forEach(t => { s[c.nombre + '|' + t] = n; }));
    return s;
  };
  const demo = (id, nombre, categoria, precio, colores, talles, descripcion, extra = {}) => ({
    id, nombre, categoria, precio, colores, talles, descripcion,
    imagenes: [], stock: stockDe(colores, talles, 5), activo: true,
    creado: Date.now() - Math.floor(Math.random() * 1e8), ...extra
  });
  const PRODUCTOS_DEMO = [
    demo('demo1', 'Remera Soft Touch', 'remeras', 12500, [C('Blanco', '#f5f2ea'), C('Negro', '#222'), C('Verde salvia', '#a9c4b5')], ['XS', 'S', 'M', 'L'], 'Remera de algodón premium de tacto suave, perfecta para el día a día.', { nuevo: true }),
    demo('demo2', 'Pollera Plisada Midi', 'polleras', 18900, [C('Champagne', '#e7d3a8'), C('Negro', '#222')], ['S', 'M', 'L', 'XL'], 'Pollera plisada midi con caída elegante. Ideal para look formal e informal.', { destacado: true }),
    demo('demo3', 'Jean Mom Fit', 'pantalones', 22500, [C('Azul clásico', '#5b7ba6'), C('Celeste', '#a9c3de')], ['36', '38', '40', '42', '44'], 'Jean mom fit de tiro alto con lavado clásico. Combina con todo.', { precioAnterior: 26900 }),
    demo('demo4', 'Vestido Seda Flores', 'vestidos', 31000, [C('Rosa empolvado', '#e8c4c0'), C('Verde', '#7aaa9d')], ['S', 'M', 'L'], 'Vestido satinado con estampado floral. Perfecto para eventos especiales.', { destacado: true }),
    demo('demo5', 'Buzo Oversize Premium', 'buzos', 16800, [C('Gris melange', '#b9b6b0'), C('Crema', '#efe6d2'), C('Negro', '#222')], ['S', 'M', 'L', 'XL'], 'Buzo oversize en algodón French Terry. Comodidad y estilo en uno.'),
    demo('demo6', 'Cartera Croco Dorada', 'accesorios', 28000, [C('Dorado', '#c8a45a')], ['Única'], 'Cartera mini con textura croco y herrajes dorados. Toque de lujo.', { nuevo: true }),
    demo('demo7', 'Blazer Lino Crudo', 'remeras', 35000, [C('Crudo', '#e9dfc9')], ['S', 'M', 'L'], 'Blazer de lino lavado en color crudo. Corte relajado y elegante.'),
    demo('demo8', 'Pollera Mini Tweed', 'polleras', 16500, [C('Multicolor', '#c9a9a0')], ['XS', 'S', 'M', 'L'], 'Mini pollera de tweed multicolor con cierre lateral. Look chic.', { precioAnterior: 19500 })
  ];

  // ── Helpers locales ───────────────────────────────────────────
  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn(e); return false; } }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const listeners = [];
  let usuarioActual = null;
  const emitir = u => { usuarioActual = u; listeners.forEach(cb => { try { cb(u); } catch (e) { console.error(e); } }); };

  // ════════════════════════════════════════════════════════════
  //  MODO DEMO (navegador)
  // ════════════════════════════════════════════════════════════
  function crearDemo() {
    const K = { prod: 'es_v2_productos', ped: 'es_v2_pedidos', users: 'es_v2_usuarios', ses: 'es_v2_sesion', cfg: 'es_v2_config', img: 'es_v2_imagenes', cup: 'es_v2_cupones' };
    if (!LS.get(K.prod)) LS.set(K.prod, PRODUCTOS_DEMO);
    const users = () => LS.get(K.users, {});
    const sesion = () => { const s = LS.get(K.ses); const u = s && users()[s]; return u ? { uid: u.uid, email: u.email, nombre: u.nombre, esAdmin: true } : null; };

    setTimeout(() => emitir(sesion()), 0);

    return {
      modo: 'demo',
      onAuth(cb) { listeners.push(cb); if (usuarioActual !== null) cb(usuarioActual); },
      usuario: () => usuarioActual,
      async registro(nombre, email, pass) {
        email = email.trim().toLowerCase();
        const us = users();
        if (us[email]) throw new Error('Ya existe una cuenta con ese email.');
        if ((pass || '').length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
        us[email] = { uid: 'u_' + uid(), email, nombre, pass, favoritos: [] };
        LS.set(K.users, us); LS.set(K.ses, email); emitir(sesion());
      },
      async login(email, pass) {
        email = email.trim().toLowerCase();
        const u = users()[email];
        if (!u || u.pass !== pass) throw new Error('Email o contraseña incorrectos.');
        LS.set(K.ses, email); emitir(sesion());
      },
      async loginGoogle() { throw new Error('En modo demo usá email y contraseña. Google funciona cuando conectes Firebase.'); },
      async recuperar() { throw new Error('En modo demo no se envían emails.'); },
      async logout() { localStorage.removeItem(K.ses); emitir(null); },
      async idToken() { return null; },

      async productos() { return LS.get(K.prod, []); },
      async guardarProducto(p) {
        const lista = LS.get(K.prod, []);
        if (!p.id) { p.id = 'p_' + uid(); p.creado = Date.now(); lista.push(p); }
        else { const i = lista.findIndex(x => x.id === p.id); if (i >= 0) lista[i] = { ...lista[i], ...p }; else lista.push(p); }
        if (!LS.set(K.prod, lista)) throw new Error('No hay más espacio en el navegador (modo demo). Probá con fotos más livianas.');
        return p.id;
      },
      async borrarProducto(id) { LS.set(K.prod, LS.get(K.prod, []).filter(p => p.id !== id)); },

      async config() { return { ...CFG.tiendaDefault, ...LS.get(K.cfg, {}) }; },
      async guardarConfig(c) { LS.set(K.cfg, { ...LS.get(K.cfg, {}), ...c }); },
      async imagenes() { return LS.get(K.img, {}); },
      async guardarImagen(key, src) {
        const im = LS.get(K.img, {}); if (src) im[key] = src; else delete im[key];
        if (!LS.set(K.img, im)) throw new Error('No hay más espacio en el navegador (modo demo). Probá con una foto más liviana.');
      },
      async cupon(codigo) { const c = String(codigo || '').trim().toUpperCase(); const l = LS.get(K.cup, {}); return l[c] ? { codigo: c, ...l[c] } : null; },
      async cupones() { return Object.entries(LS.get(K.cup, {})).map(([codigo, d]) => ({ codigo, ...d })); },
      async guardarCupon(codigo, d) { const l = LS.get(K.cup, {}); l[codigo] = d; LS.set(K.cup, l); },
      async borrarCupon(codigo) { const l = LS.get(K.cup, {}); delete l[codigo]; LS.set(K.cup, l); },

      async favoritos() { const s = LS.get(K.ses); return s ? (users()[s]?.favoritos || []) : []; },
      async toggleFavorito(pid) {
        const s = LS.get(K.ses); if (!s) throw new Error('login');
        const us = users(); const f = new Set(us[s].favoritos || []);
        f.has(pid) ? f.delete(pid) : f.add(pid);
        us[s].favoritos = [...f]; LS.set(K.users, us); return us[s].favoritos;
      },

      async crearPedido(ped) {
        const lista = LS.get(K.ped, []);
        const id = 'ES-' + Date.now().toString(36).toUpperCase().slice(-6);
        lista.unshift({ ...ped, id, creado: Date.now() });
        LS.set(K.ped, lista); return id;
      },
      async pedido(id) { return LS.get(K.ped, []).find(p => p.id === id) || null; },
      async misPedidos() { const u = usuarioActual; return u ? LS.get(K.ped, []).filter(p => p.uid === u.uid) : []; },
      async pedidos() { return LS.get(K.ped, []); },
      async actualizarPedido(id, cambios) {
        const lista = LS.get(K.ped, []); const i = lista.findIndex(p => p.id === id);
        if (i >= 0) { lista[i] = { ...lista[i], ...cambios }; LS.set(K.ped, lista); }
      },
      // Simula lo que hace el servidor cuando Mercado Pago confirma el pago
      async pagarDemo(id) {
        const peds = LS.get(K.ped, []); const ped = peds.find(p => p.id === id); if (!ped) return;
        const prods = LS.get(K.prod, []);
        ped.items.forEach(it => {
          const p = prods.find(x => x.id === it.pid); if (!p) return;
          const k = (it.color || '-') + '|' + it.talle;
          if (p.stock && k in p.stock) p.stock[k] = Math.max(0, p.stock[k] - it.cant);
        });
        ped.estado = 'pagado'; ped.pagoEstado = 'approved'; ped.stockDescontado = true;
        LS.set(K.prod, prods); LS.set(K.ped, peds);
      }
    };
  }

  // ════════════════════════════════════════════════════════════
  //  MODO FIREBASE (real)
  // ════════════════════════════════════════════════════════════
  function crearFirebase() {
    firebase.initializeApp(CFG.firebase);
    const auth = firebase.auth();
    const db = firebase.firestore();
    auth.languageCode = 'es';
    const TS = () => firebase.firestore.FieldValue.serverTimestamp();
    const fecha = v => (v && v.toMillis) ? v.toMillis() : (v || 0);
    const doc2obj = d => { const o = { id: d.id, ...d.data() }; if (o.creado) o.creado = fecha(o.creado); return o; };

    auth.onAuthStateChanged(async fu => {
      if (!fu) return emitir(null);
      let esAdmin = false;
      try { esAdmin = (await db.collection('admins').doc(fu.uid).get()).exists; } catch { }
      emitir({ uid: fu.uid, email: fu.email, nombre: fu.displayName || (fu.email || '').split('@')[0], esAdmin });
    });

    const traducir = e => {
      const m = {
        'auth/invalid-credential': 'Email o contraseña incorrectos.',
        'auth/wrong-password': 'Email o contraseña incorrectos.',
        'auth/user-not-found': 'No hay una cuenta con ese email.',
        'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/invalid-email': 'El email no es válido.',
        'auth/popup-closed-by-user': 'Cerraste la ventana de Google.',
        'auth/too-many-requests': 'Demasiados intentos. Esperá un ratito y probá de nuevo.'
      };
      return new Error(m[e.code] || e.message);
    };

    return {
      modo: 'firebase',
      onAuth(cb) { listeners.push(cb); if (usuarioActual !== null) cb(usuarioActual); },
      usuario: () => usuarioActual,
      async registro(nombre, email, pass) {
        try {
          const r = await auth.createUserWithEmailAndPassword(email.trim(), pass);
          await r.user.updateProfile({ displayName: nombre });
          await db.collection('usuarios').doc(r.user.uid).set({ nombre, email: email.trim(), favoritos: [], creado: TS() }, { merge: true });
          emitir({ uid: r.user.uid, email: r.user.email, nombre, esAdmin: false });
        } catch (e) { throw traducir(e); }
      },
      async login(email, pass) { try { await auth.signInWithEmailAndPassword(email.trim(), pass); } catch (e) { throw traducir(e); } },
      async loginGoogle() {
        try {
          const r = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
          await db.collection('usuarios').doc(r.user.uid).set({ nombre: r.user.displayName || '', email: r.user.email }, { merge: true });
        } catch (e) { throw traducir(e); }
      },
      async recuperar(email) { try { await auth.sendPasswordResetEmail(email.trim()); } catch (e) { throw traducir(e); } },
      async logout() { await auth.signOut(); },
      async idToken() { return auth.currentUser ? auth.currentUser.getIdToken() : null; },

      async productos() { return (await db.collection('productos').get()).docs.map(doc2obj); },
      async guardarProducto(p) {
        const { id, ...data } = p;
        data.actualizado = TS();
        if (id) { await db.collection('productos').doc(id).set(data, { merge: true }); return id; }
        data.creado = TS();
        return (await db.collection('productos').add(data)).id;
      },
      async borrarProducto(id) { await db.collection('productos').doc(id).delete(); },

      async config() {
        const d = await db.collection('config').doc('tienda').get();
        return { ...CFG.tiendaDefault, ...(d.exists ? d.data() : {}) };
      },
      async guardarConfig(c) { await db.collection('config').doc('tienda').set(c, { merge: true }); },
      // Fotos de la página (portada, categorías, nosotros): un documento por foto
      async imagenes() {
        const q = await db.collection('imagenes').get();
        return Object.fromEntries(q.docs.map(d => [d.id, d.data().src]));
      },
      async guardarImagen(key, src) {
        const ref = db.collection('imagenes').doc(key);
        if (src) await ref.set({ src, actualizado: TS() }); else await ref.delete();
      },
      // Cupones: cada uno es un documento con el código como nombre (nadie puede listarlos salvo el admin)
      async cupon(codigo) {
        const c = String(codigo || '').trim().toUpperCase(); if (!c || c.includes('/')) return null;
        const d = await db.collection('cupones').doc(c).get();
        return d.exists ? { codigo: c, ...d.data() } : null;
      },
      async cupones() { const q = await db.collection('cupones').get(); return q.docs.map(d => ({ codigo: d.id, ...d.data() })); },
      async guardarCupon(codigo, d) { await db.collection('cupones').doc(codigo).set(d); },
      async borrarCupon(codigo) { await db.collection('cupones').doc(codigo).delete(); },

      async favoritos() {
        if (!usuarioActual) return [];
        const d = await db.collection('usuarios').doc(usuarioActual.uid).get();
        return (d.exists && d.data().favoritos) || [];
      },
      async toggleFavorito(pid) {
        if (!usuarioActual) throw new Error('login');
        const ref = db.collection('usuarios').doc(usuarioActual.uid);
        const actuales = await this.favoritos();
        const op = actuales.includes(pid) ? firebase.firestore.FieldValue.arrayRemove(pid) : firebase.firestore.FieldValue.arrayUnion(pid);
        await ref.set({ favoritos: op }, { merge: true });
        return this.favoritos();
      },

      async crearPedido(ped) {
        const ref = await db.collection('pedidos').add({ ...ped, creado: TS() });
        return ref.id;
      },
      async pedido(id) { const d = await db.collection('pedidos').doc(id).get(); return d.exists ? doc2obj(d) : null; },
      async misPedidos() {
        if (!usuarioActual) return [];
        const q = await db.collection('pedidos').where('uid', '==', usuarioActual.uid).get();
        return q.docs.map(doc2obj).sort((a, b) => b.creado - a.creado);
      },
      async pedidos() {
        const q = await db.collection('pedidos').orderBy('creado', 'desc').limit(500).get();
        return q.docs.map(doc2obj);
      },
      async actualizarPedido(id, cambios) { await db.collection('pedidos').doc(id).update({ ...cambios, actualizado: TS() }); },
      async pagarDemo() { throw new Error('Solo disponible en modo demo.'); }
    };
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

  window.DB = usarFirebase ? crearFirebase() : crearDemo();

  // ── Utilidades compartidas ────────────────────────────────────
  window.ES = {
    calcularCupon,
    // Categorías de la tienda (vienen de Ajustes; si no hay, las de config.js)
    categorias: cfg => ((cfg && cfg.categorias && cfg.categorias.length) ? cfg.categorias : (CFG.tiendaDefault.categorias || [])),
    slug: t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat',
    mapaEmbed: q => 'https://maps.google.com/maps?q=' + encodeURIComponent(q || '') + '&z=17&output=embed',
    mapaLink: q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q || ''),
    mapaComoLlegar: q => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q || ''),
    ESTADOS: {
      pendiente: { label: 'Pendiente de pago', color: '#c8a45a' },
      pagado: { label: 'Pagado', color: '#4f9d6e' },
      preparando: { label: 'Preparando', color: '#7aaa9d' },
      enviado: { label: 'Enviado', color: '#5b7ba6' },
      listo: { label: 'Listo para retirar', color: '#5b7ba6' },
      entregado: { label: 'Entregado', color: '#3a3228' },
      cancelado: { label: 'Cancelado', color: '#c0564b' }
    },
    precio: n => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR'),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    claveStock: (color, talle) => (color || '-') + '|' + talle,
    // Stock disponible. Si el producto no tiene stock cargado para esa combinación, se toma como sin límite.
    stockDe(p, color, talle) {
      if (!p || !p.stock) return Infinity;
      const k = ES.claveStock(color, talle);
      return (k in p.stock) ? Number(p.stock[k]) || 0 : Infinity;
    },
    stockTotal(p) {
      if (!p || !p.stock || !Object.keys(p.stock).length) return Infinity;
      return Object.values(p.stock).reduce((a, b) => a + (Number(b) || 0), 0);
    },
    fecha: ms => ms ? new Date(ms).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
    // Achica una foto antes de guardarla (para que cargue rápido y entre en la base)
    achicarImagen(file, max = 900, calidad = 0.78) {
      return new Promise((ok, mal) => {
        const r = new FileReader();
        r.onerror = mal;
        r.onload = () => {
          const img = new Image();
          img.onerror = mal;
          img.onload = () => {
            const k = Math.min(1, max / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            ok(c.toDataURL('image/jpeg', calidad));
          };
          img.src = r.result;
        };
        r.readAsDataURL(file);
      });
    },
    toast(msg, tipo = '') {
      const cont = document.getElementById('toastContainer'); if (!cont) return;
      const t = document.createElement('div');
      t.className = 'toast ' + tipo;
      t.textContent = msg;
      cont.appendChild(t);
      setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 3200);
    }
  };

  // Botón de "ojito" para ver u ocultar la contraseña
  const OJO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OJO_NO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';
  function ponerOjitos() {
    document.querySelectorAll('input[type="password"]:not([data-ojito])').forEach(inp => {
      inp.dataset.ojito = '1';
      const wrap = document.createElement('div'); wrap.className = 'pass-wrap';
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pass-ojo';
      b.setAttribute('aria-label', 'Mostrar contraseña'); b.innerHTML = OJO;
      b.onclick = () => {
        const ver = inp.type === 'password'; inp.type = ver ? 'text' : 'password';
        b.innerHTML = ver ? OJO_NO : OJO; b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
        inp.focus();
      };
      wrap.appendChild(b);
    });
  }
  window.ES.ponerOjitos = ponerOjitos;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ponerOjitos); else ponerOjitos();
})();
