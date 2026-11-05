/* ============================================================
   ESTILO SELECT — Panel de administración
   Pensado para usar fácil: todo se carga con toques y fotos.
   ============================================================ */
const { precio: $p, esc } = ES;
let productos = [], pedidos = [], config = {}, imagenes = {};
let vista = 'resumen';

const $ = id => document.getElementById(id);
const cats = () => ES.categorias(config);
const CAT_LABEL = new Proxy({}, { get: (_, k) => (cats().find(c => c.key === k) || {}).label || k });
function abrirModal(id) { $(id).classList.add('open'); }
function cerrarModal(id) { $(id).classList.remove('open'); }
const numeroPedido = pd => pd.numero || String(pd.id).slice(-6).toUpperCase();
const chipEstado = e => { const s = ES.ESTADOS[e] || { label: e, color: '#999' }; return `<span class="chip-estado" style="--c:${s.color}">${s.label}</span>`; };

// Elegir una foto del celu/compu y devolverla achicada
function elegirFoto(max = 1200) {
  return new Promise(ok => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return ok(null); try { ok(await ES.achicarImagen(f, max, .8)); } catch { ES.toast('No se pudo leer la foto', 'error'); ok(null); } };
    inp.click();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (DB.modo === 'demo') { $('demoBar').classList.remove('hidden'); document.querySelectorAll('.demo-only').forEach(e => e.classList.remove('hidden')); }
  document.querySelectorAll('#admTabs button').forEach(b => b.onclick = () => mostrar(b.dataset.v));
  $('pedEstado').innerHTML += Object.entries(ES.ESTADOS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  ['prodBuscar', 'prodCat'].forEach(id => $(id).addEventListener('input', renderProductos));
  ['pedBuscar', 'pedEstado'].forEach(id => $(id).addEventListener('input', renderPedidos));
  $('admLoginForm').addEventListener('submit', loginAdmin);
  $('prodForm').addEventListener('submit', guardarProducto);
  $('ajustesForm').addEventListener('submit', guardarAjustes);
  $('fArchivos').addEventListener('change', e => { subirFotos([...e.target.files]); e.target.value = ''; });
  const drop = $('dropFotos');
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('sobre'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('sobre')));
  drop.addEventListener('drop', e => { e.preventDefault(); subirFotos([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); });
  $('fTalleNuevo').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const t = e.target.value.trim(); if (t) { if (!edit.talles.includes(t)) edit.talles.push(t); e.target.value = ''; renderTalles(); renderStock(); } } });
  $('fStockSimple').addEventListener('input', renderStockTxt);
  $('pMapa').addEventListener('change', previsualizarMapa);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); });
  window.addEventListener('beforeunload', e => { if (paginaSucia) { e.preventDefault(); e.returnValue = ''; } });

  DB.onAuth(async u => {
    const ok = u && u.esAdmin;
    $('vLogin').classList.toggle('hidden', !!ok);
    $('admTabs').classList.toggle('hidden', !ok);
    $('admUser').textContent = u ? u.email : '';
    if (u && !u.esAdmin) $('loginMsg').innerHTML = `La cuenta <b>${esc(u.email)}</b> no es administradora. Pedí que la agreguen en Firebase (ver LEEME).<br><button class="link-btn" onclick="DB.logout()">Usar otra cuenta</button>`;
    if (!ok) { document.querySelectorAll('.adm-vista').forEach(v => v.classList.add('hidden')); return; }
    await cargarTodo();
    const m = location.hash.match(/editar=([^&]+)/);
    mostrar(m ? 'productos' : vista);
    if (m) { history.replaceState(null, '', location.pathname); editarProducto(decodeURIComponent(m[1])); }
  });
});

async function loginAdmin(e) {
  e.preventDefault();
  try { await DB.login($('lEmail').value, $('lPass').value); }
  catch (err) { $('lError').textContent = err.message; $('lError').classList.remove('hidden'); }
}

async function cargarTodo() {
  try {
    [productos, pedidos, config, imagenes] = await Promise.all([DB.productos(), DB.pedidos(), DB.config(), DB.imagenes().catch(() => ({}))]);
  } catch (e) { ES.toast('Error cargando datos: ' + e.message, 'error'); }
  const pend = pedidos.filter(p => p.estado === 'pagado').length;
  $('badgePendientes').textContent = pend;
  $('badgePendientes').classList.toggle('hidden', !pend);
  $('atajoPedidos').textContent = pend ? `¡${pend} para preparar!` : 'Lo que te compraron';
  $('prodCat').innerHTML = '<option value="">Todas las categorías</option>' + cats().map(c => `<option value="${c.key}">${esc(c.label)}</option>`).join('');
}

function mostrar(v) {
  if (vista === 'pagina' && v !== 'pagina' && paginaSucia && !confirm('Tenés cambios sin guardar en "Mi página". ¿Salir igual?')) return;
  if (v !== 'pagina') paginaSucia = false;
  vista = v;
  document.querySelectorAll('#admTabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  document.querySelectorAll('.adm-vista').forEach(s => s.classList.add('hidden'));
  $('v' + v[0].toUpperCase() + v.slice(1)).classList.remove('hidden');
  ({ resumen: renderResumen, pedidos: renderPedidos, productos: renderProductos, pagina: renderPagina, ajustes: renderAjustes })[v]();
  window.scrollTo({ top: 0 });
}

// ── Resumen ─────────────────────────────────────────────────────
function renderResumen() {
  const cobrados = pedidos.filter(p => !['pendiente', 'cancelado'].includes(p.estado));
  const hace30 = Date.now() - 30 * 864e5;
  const mes = cobrados.filter(p => p.creado >= hace30);
  const ventasMes = mes.reduce((s, p) => s + (p.total || 0), 0);
  const porPreparar = pedidos.filter(p => p.estado === 'pagado').length;
  const sinStock = productos.filter(p => p.activo !== false && ES.stockTotal(p) <= 0).length;
  const kpi = (n, l, sub = '') => `<div class="kpi"><div class="kpi-n">${n}</div><div class="kpi-l">${l}</div>${sub ? `<div class="kpi-s">${sub}</div>` : ''}</div>`;
  $('kpis').innerHTML =
    kpi($p(ventasMes), 'Ventas últimos 30 días', `${mes.length} pedidos cobrados`) +
    kpi(porPreparar, 'Pagados por preparar', porPreparar ? '¡A armar paquetes!' : 'Todo al día') +
    kpi(mes.length ? $p(ventasMes / mes.length) : '—', 'Ticket promedio') +
    kpi(productos.filter(p => p.activo !== false).length, 'Productos visibles', sinStock ? `${sinStock} sin stock` : '');

  $('resUltimos').innerHTML = pedidos.slice(0, 6).map(pd => `
    <div class="res-fila" onclick="verPedido('${pd.id}')"><div><b>#${esc(numeroPedido(pd))}</b> ${esc(pd.cliente?.nombre || '')}<br><small class="texto-suave">${ES.fecha(pd.creado)}</small></div><div style="text-align:right">${$p(pd.total)}<br>${chipEstado(pd.estado)}</div></div>`).join('')
    || '<p class="texto-suave">Todavía no hay pedidos.</p>';

  const bajos = [];
  productos.forEach(p => Object.entries(p.stock || {}).forEach(([k, n]) => { if (n <= 2) bajos.push({ p, k, n }); }));
  $('resStock').innerHTML = bajos.slice(0, 10).map(b => `
    <div class="res-fila" onclick="editarProducto('${b.p.id}')"><div><b>${esc(b.p.nombre)}</b><br><small class="texto-suave">${esc(b.k.replace('-|', '').replace('|', ' · '))}</small></div><div class="${b.n ? 'stock-poco' : 'stock-no'}">${b.n} u.</div></div>`).join('')
    || '<p class="texto-suave">Todo con stock 👌</p>';
}

// ── Pedidos ─────────────────────────────────────────────────────
function renderPedidos() {
  const q = $('pedBuscar').value.trim().toLowerCase();
  const est = $('pedEstado').value;
  const l = pedidos.filter(pd => (!est || pd.estado === est) &&
    (!q || [numeroPedido(pd), pd.cliente?.nombre, pd.cliente?.email, pd.cliente?.telefono].join(' ').toLowerCase().includes(q)));
  $('tablaPedidos').innerHTML = `
    <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th>Pago</th><th>Total</th><th>Estado</th></tr></thead>
    <tbody>${l.map(pd => `
      <tr onclick="verPedido('${pd.id}')">
        <td><b>${esc(numeroPedido(pd))}</b></td>
        <td>${ES.fecha(pd.creado)}</td>
        <td>${esc(pd.cliente?.nombre || '')}<br><small class="texto-suave">${esc(pd.cliente?.telefono || '')}</small></td>
        <td>${pd.entrega?.tipo === 'envio' ? '🚚 Envío' : '🏬 Retiro'}</td>
        <td>${pd.metodoPago === 'mp' ? 'Mercado Pago' : 'Transf./efectivo'}</td>
        <td><b>${$p(pd.total)}</b></td>
        <td>${chipEstado(pd.estado)}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="texto-suave" style="text-align:center;padding:2rem">No hay pedidos.</td></tr>'}
    </tbody>`;
}

function verPedido(id) {
  const pd = pedidos.find(p => p.id === id); if (!pd) return;
  const c = pd.cliente || {}, en = pd.entrega || {};
  const tel = String(c.telefono || '').replace(/\D/g, '');
  const telWa = tel.startsWith('54') ? tel : '549' + tel.replace(/^0/, '');
  const msg = encodeURIComponent(`¡Hola ${c.nombre || ''}! Te escribimos de Estilo Select por tu pedido #${numeroPedido(pd)}.`);
  // Control: total recalculado con los precios guardados en el pedido
  const sumaItems = (pd.items || []).reduce((s, it) => s + it.precio * it.cant, 0);
  const alerta = Math.abs(sumaItems + (pd.envio || 0) - pd.total) > 1 ? '<div class="form-error">⚠ El total no coincide con la suma de los productos. Revisalo antes de despachar.</div>' : '';
  $('pedTitulo').textContent = `Pedido #${numeroPedido(pd)}`;
  $('pedCuerpo').innerHTML = `
    ${alerta}
    <div class="adm-2col">
      <div>
        <h4 class="adm-h4">Cliente</h4>
        <p><b>${esc(c.nombre)}</b><br>${esc(c.email)}<br>${esc(c.telefono)}</p>
        ${tel ? `<a class="btn-primary btn-wa" style="display:inline-block;margin-top:.75rem;padding:.55rem 1.2rem" href="https://wa.me/${telWa}?text=${msg}" target="_blank" rel="noopener">Escribir por WhatsApp</a>` : ''}
      </div>
      <div>
        <h4 class="adm-h4">Entrega</h4>
        <p>${en.tipo === 'envio' ? `🚚 Envío a domicilio<br>${esc(en.direccion)}<br>${esc(en.ciudad)} (${esc(en.cp)})` : '🏬 Retiro en el local'}</p>
        ${en.notas ? `<p class="texto-suave" style="margin-top:.5rem">📝 ${esc(en.notas)}</p>` : ''}
      </div>
    </div>
    <h4 class="adm-h4">Productos</h4>
    <table class="adm-tabla adm-tabla-sm"><tbody>
      ${(pd.items || []).map(it => `<tr><td>${it.cant}×</td><td>${esc(it.nombre)}<br><small class="texto-suave">${it.color ? esc(it.color) + ' · ' : ''}${esc(it.talle)}</small></td><td style="text-align:right">${$p(it.precio * it.cant)}</td></tr>`).join('')}
      <tr><td></td><td>Envío</td><td style="text-align:right">${pd.envio ? $p(pd.envio) : 'Gratis'}</td></tr>
      <tr><td></td><td><b>Total</b></td><td style="text-align:right"><b>${$p(pd.total)}</b></td></tr>
    </tbody></table>
    <p class="texto-suave" style="font-size:.8rem;margin-top:.75rem">Pago: ${pd.metodoPago === 'mp' ? 'Mercado Pago' : 'Transferencia / efectivo'}${pd.pagoId ? ` · operación ${esc(pd.pagoId)}` : ''}${pd.pagoEstado ? ` (${esc(pd.pagoEstado)})` : ''} · ${ES.fecha(pd.creado)}</p>
    <h4 class="adm-h4">Estado</h4>
    <div class="adm-estados">${Object.entries(ES.ESTADOS).map(([k, v]) => `<button class="${pd.estado === k ? 'on' : ''}" style="--c:${v.color}" onclick="cambiarEstado('${pd.id}','${k}')">${v.label}</button>`).join('')}</div>
    <div class="form-group" style="margin-top:1rem"><label class="form-label" for="pedSeguimiento">Código de seguimiento / nota interna</label>
      <div style="display:flex;gap:.5rem"><input class="form-input" id="pedSeguimiento" value="${esc(pd.seguimiento || '')}"><button class="btn-form-cancel" onclick="guardarSeguimiento('${pd.id}')">Guardar</button></div></div>`;
  abrirModal('modalPed');
}

async function cambiarEstado(id, estado) {
  const pd = pedidos.find(p => p.id === id);
  if (estado === 'pagado' && pd.metodoPago === 'mp' && pd.estado === 'pendiente' &&
    !confirm('Este pedido es de Mercado Pago y todavía no llegó la confirmación del pago. ¿Marcarlo como pagado igual?')) return;
  try {
    await DB.actualizarPedido(id, { estado });
    pd.estado = estado;
    ES.toast('Estado actualizado', 'success');
    verPedido(id); renderPedidos(); cargarTodo();
  } catch (e) { ES.toast(e.message, 'error'); }
}
async function guardarSeguimiento(id) {
  const v = $('pedSeguimiento').value.trim();
  try { await DB.actualizarPedido(id, { seguimiento: v }); pedidos.find(p => p.id === id).seguimiento = v; ES.toast('Guardado', 'success'); }
  catch (e) { ES.toast(e.message, 'error'); }
}

// ── Productos: lista con fotos grandes ─────────────────────────
function renderProductos() {
  const q = $('prodBuscar').value.trim().toLowerCase();
  const cat = $('prodCat').value;
  const l = productos.filter(p => (!cat || p.categoria === cat) && (!q || p.nombre.toLowerCase().includes(q)))
    .sort((a, b) => (b.creado || 0) - (a.creado || 0));
  $('listaProductos').innerHTML = l.map(p => {
    const st = ES.stockTotal(p); const foto = (p.imagenes || [])[0] || p.imagen;
    return `<div class="adm-prod ${p.activo === false ? 'oculto' : ''}">
      <div class="adm-prod-foto" onclick="editarProducto('${p.id}')">${foto ? `<img src="${esc(foto)}" alt="">` : '<span>📷<small>Sin foto</small></span>'}
        ${p.activo === false ? '<em>Oculto</em>' : st <= 0 ? '<em class="agotado">Sin stock</em>' : ''}</div>
      <div class="adm-prod-info">
        <small>${esc(CAT_LABEL[p.categoria])}</small>
        <b>${esc(p.nombre)}</b>
        <div class="adm-prod-precio">${$p(p.precio)}${p.precioAnterior > p.precio ? ` <s>${$p(p.precioAnterior)}</s>` : ''}</div>
        <div class="adm-prod-stock ${st <= 0 ? 'stock-no' : st <= 5 ? 'stock-poco' : ''}">${st === Infinity ? 'Stock sin límite' : st + ' unidades'}</div>
        <div class="adm-prod-acc">
          <button onclick="editarProducto('${p.id}')">✏️ Editar</button>
          <button onclick="toggleVisible('${p.id}')">${p.activo === false ? '👁 Mostrar' : '🙈 Ocultar'}</button>
          <button onclick="duplicarProducto('${p.id}')" title="Crear uno parecido">⧉</button>
          <button class="peligro" onclick="borrarProducto('${p.id}')" title="Borrar">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('') || `<div class="adm-vacio"><span>👗</span><p>${productos.length ? 'No hay productos con esa búsqueda.' : 'Todavía no cargaste productos.'}</p><button class="btn-primary" onclick="editarProducto()">➕ Agregar el primero</button></div>`;
}

async function toggleVisible(id) {
  const p = productos.find(x => x.id === id);
  try { await DB.guardarProducto({ id, activo: p.activo === false }); p.activo = p.activo === false; renderProductos(); ES.toast(p.activo ? 'Ahora se ve en la tienda' : 'Oculto de la tienda', 'success'); }
  catch (e) { ES.toast(e.message, 'error'); }
}

// ── Formulario de producto (por pasos) ─────────────────────────
const PALETA = [
  ['Negro', '#222222'], ['Blanco', '#f8f6f0'], ['Crudo', '#e9dfc9'], ['Beige', '#d9c3a0'], ['Camel', '#b88a5a'], ['Marrón', '#6b4a33'],
  ['Gris', '#9a9a9a'], ['Azul', '#2f4a7a'], ['Jean', '#5b7ba6'], ['Celeste', '#a9c3de'], ['Verde', '#5f8a6e'], ['Verde agua', '#a9c4b5'],
  ['Rojo', '#b8312f'], ['Bordó', '#6d1f2c'], ['Rosa', '#e8b4bc'], ['Fucsia', '#c2337a'], ['Lila', '#b9a3cf'], ['Amarillo', '#e9c46a'],
  ['Naranja', '#e07a3f'], ['Dorado', '#c8a45a'], ['Plateado', '#c0c0c0'], ['Estampado', '#c9a9a0']
];
const T_LETRAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const T_NUMEROS = ['34', '36', '38', '40', '42', '44', '46', '48'];
let edit = null;      // producto que se está editando
let modoStock = 'simple';

function editarProducto(id) {
  const p = id ? productos.find(x => x.id === id) : null;
  edit = p ? JSON.parse(JSON.stringify(p)) : { imagenes: [], colores: [], talles: [], stock: {}, activo: true, categoria: (cats()[0] || {}).key };
  if (!edit.imagenes) edit.imagenes = edit.imagen ? [edit.imagen] : [];
  edit.colores = [...(edit.colores || [])]; edit.talles = [...(edit.talles || [])]; edit.stock = { ...(edit.stock || {}) };
  $('prodTitulo').textContent = p ? 'Editar producto' : 'Agregar producto';
  $('fNombre').value = edit.nombre || '';
  $('fPrecio').value = edit.precio ?? '';
  $('fPrecioAnt').value = edit.precioAnterior || '';
  $('fDescripcion').value = edit.descripcion || '';
  $('fDestacado').checked = !!edit.destacado;
  $('fNuevo').checked = p ? !!edit.nuevo : true;
  $('fActivo').checked = edit.activo !== false;
  $('prodError').classList.add('hidden');
  // Si todas las combinaciones tienen el mismo stock, mostrar el modo simple
  const vals = Object.values(edit.stock);
  const iguales = vals.length === 0 || vals.every(v => v === vals[0]);
  $('fStockSimple').value = vals.length ? vals[0] : 3;
  $('fStock').innerHTML = '';
  cambiarModoStock(iguales ? 'simple' : 'detalle', true);
  renderCategoriasElegir(); renderPaleta(); renderTalles(); renderFotos(); renderStock();
  abrirModal('modalProd');
  setTimeout(() => $('modalProd').querySelector('.modal').scrollTo({ top: 0 }), 0);
}
function duplicarProducto(id) {
  editarProducto(id);
  delete edit.id; edit.nombre += ' (copia)';
  $('fNombre').value = edit.nombre; $('prodTitulo').textContent = 'Agregar producto (copia)';
}

function renderCategoriasElegir() {
  $('fCategorias').innerHTML = cats().map(c => `<button type="button" class="chip-elegir ${edit.categoria === c.key ? 'on' : ''}" onclick="edit.categoria='${c.key}';renderCategoriasElegir()">${esc(c.icon || '')} ${esc(c.label)}</button>`).join('')
    + `<button type="button" class="chip-elegir chip-nuevo" onclick="nuevaCategoriaRapida()">➕ Nueva</button>`;
}
async function nuevaCategoriaRapida() {
  const nombre = (prompt('Nombre de la nueva categoría (ej: Camperas)') || '').trim(); if (!nombre) return;
  let key = ES.slug(nombre); while (cats().some(c => c.key === key)) key += '-2';
  config.categorias = [...cats(), { key, label: nombre, icon: '✦' }];
  try { await DB.guardarConfig({ categorias: config.categorias }); edit.categoria = key; renderCategoriasElegir(); ES.toast(`Categoría "${nombre}" creada`, 'success'); }
  catch (e) { ES.toast(e.message, 'error'); }
}

// Colores
function renderPaleta() {
  const elegidos = new Set(edit.colores.map(c => c.nombre));
  const extra = edit.colores.filter(c => !PALETA.some(([n]) => n === c.nombre)).map(c => [c.nombre, c.hex]);
  $('fPaleta').innerHTML = [...PALETA, ...extra].map(([n, h]) => `
    <button type="button" class="color-chip ${elegidos.has(n) ? 'on' : ''}" onclick="toggleColor(${esc(JSON.stringify(n))},'${h}')">
      <i style="background:${n === 'Estampado' ? 'conic-gradient(#e8b4bc,#a9c3de,#e9c46a,#a9c4b5,#e8b4bc)' : h}"></i>${esc(n)}</button>`).join('');
}
function toggleColor(nombre, hex) {
  const i = edit.colores.findIndex(c => c.nombre === nombre);
  if (i >= 0) edit.colores.splice(i, 1); else edit.colores.push({ nombre, hex });
  renderPaleta(); renderStock();
}
function agregarColorOtro() {
  const n = $('fOtroNombre').value.trim(); if (!n) return ES.toast('Escribí el nombre del color', 'error');
  if (!edit.colores.some(c => c.nombre === n)) edit.colores.push({ nombre: n, hex: $('fOtroHex').value });
  $('fOtroNombre').value = ''; renderPaleta(); renderStock();
}

// Talles
function renderTalles() {
  const chip = t => `<button type="button" class="chip-elegir chip-talle ${edit.talles.includes(t) ? 'on' : ''}" onclick="toggleTalle(${esc(JSON.stringify(t))})">${esc(t)}</button>`;
  $('fTallesLetras').innerHTML = T_LETRAS.map(chip).join('');
  $('fTallesNumeros').innerHTML = T_NUMEROS.map(chip).join('');
  const otros = ['Única', ...edit.talles.filter(t => t !== 'Única' && !T_LETRAS.includes(t) && !T_NUMEROS.includes(t))];
  $('fTallesOtros').innerHTML = otros.map(chip).join('');
}
function toggleTalle(t) {
  if (t === 'Única') edit.talles = edit.talles.includes('Única') ? [] : ['Única'];
  else {
    edit.talles = edit.talles.filter(x => x !== 'Única');
    edit.talles = edit.talles.includes(t) ? edit.talles.filter(x => x !== t) : [...edit.talles, t];
    const orden = [...T_LETRAS, ...T_NUMEROS];
    edit.talles.sort((a, b) => (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99));
  }
  renderTalles(); renderStock();
}

// Stock
const tallesEfectivos = () => edit.talles.length ? edit.talles : ['Única'];
const coloresEfectivos = () => edit.colores.length ? edit.colores : [{ nombre: '-' }];
function cambiarModoStock(m, silencio) {
  if (!silencio && m === 'detalle') leerStockSimpleEnDetalle();
  modoStock = m;
  document.querySelector(`input[name=modoStock][value=${m}]`).checked = true;
  $('optStockSimple').classList.toggle('on', m === 'simple');
  $('optStockDetalle').classList.toggle('on', m === 'detalle');
  $('stockSimple').classList.toggle('hidden', m !== 'simple');
  $('fStock').classList.toggle('hidden', m !== 'detalle');
  renderStock();
}
function leerStockSimpleEnDetalle() {
  const n = Math.max(0, parseInt($('fStockSimple').value, 10) || 0);
  coloresEfectivos().forEach(c => tallesEfectivos().forEach(t => { const k = ES.claveStock(c.nombre, t); if (!(k in edit.stock)) edit.stock[k] = n; }));
}
function pasoStock(d) { const i = $('fStockSimple'); i.value = Math.max(0, (parseInt(i.value, 10) || 0) + d); renderStockTxt(); }
function renderStockTxt() {
  const n = Math.max(0, parseInt($('fStockSimple').value, 10) || 0);
  const comb = coloresEfectivos().length * tallesEfectivos().length;
  $('stockSimpleTxt').textContent = comb > 1 ? `de cada uno → ${n * comb} en total (${comb} combinaciones)` : 'unidades';
}
function leerStockDelForm() {
  document.querySelectorAll('#fStock input[data-k]').forEach(i => { edit.stock[i.dataset.k] = Math.max(0, parseInt(i.value, 10) || 0); });
}
function renderStock() {
  renderStockTxt();
  if (modoStock !== 'detalle') return;
  if ($('fStock').querySelector('input')) leerStockDelForm();
  const talles = tallesEfectivos(), colores = coloresEfectivos();
  $('fStock').innerHTML = `<table><thead><tr><th></th>${talles.map(t => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>
    ${colores.map(c => `<tr><th>${c.nombre === '-' ? 'Unidades' : esc(c.nombre)}</th>${talles.map(t => { const k = ES.claveStock(c.nombre, t); return `<td><input type="number" min="0" inputmode="numeric" data-k="${esc(k)}" value="${edit.stock[k] ?? ''}" placeholder="0"></td>`; }).join('')}</tr>`).join('')}
  </tbody></table>`;
}

// Fotos del producto
function renderFotos() {
  $('fFotos').innerHTML = edit.imagenes.map((src, i) => `
    <div class="adm-foto ${i === 0 ? 'principal' : ''}"><img src="${esc(src)}" alt="">
      ${i === 0 ? '<span class="adm-foto-tag">Principal</span>' : ''}
      <div>${i > 0 ? `<button type="button" title="Hacer principal" onclick="fotoPrincipal(${i})">★</button>` : ''}<button type="button" title="Quitar" onclick="quitarFoto(${i})">✕</button></div></div>`).join('');
  $('dropFotos').classList.toggle('compacto', edit.imagenes.length > 0);
}
async function subirFotos(files) {
  files = files.slice(0, 5 - edit.imagenes.length);
  if (!files.length) return ES.toast('Máximo 5 fotos por producto', 'error');
  ES.toast('Preparando fotos...');
  for (const f of files) { try { edit.imagenes.push(await ES.achicarImagen(f)); } catch { ES.toast('No se pudo leer ' + f.name, 'error'); } }
  renderFotos();
}
function quitarFoto(i) { edit.imagenes.splice(i, 1); renderFotos(); }
function fotoPrincipal(i) { const [f] = edit.imagenes.splice(i, 1); edit.imagenes.unshift(f); renderFotos(); }

async function guardarProducto(e) {
  e.preventDefault();
  const err = m => { $('prodError').textContent = m; $('prodError').classList.remove('hidden'); $('prodError').scrollIntoView({ block: 'center' }); };
  const nombre = $('fNombre').value.trim();
  const precio = Number($('fPrecio').value);
  if (!nombre) return err('Falta el nombre del producto (paso 2).');
  if (!(precio > 0)) return err('Falta el precio (paso 2).');
  if (!edit.categoria) return err('Elegí una categoría (paso 2).');
  const talles = tallesEfectivos(), colores = edit.colores;
  const stock = {};
  if (modoStock === 'simple') {
    const n = Math.max(0, parseInt($('fStockSimple').value, 10) || 0);
    coloresEfectivos().forEach(c => talles.forEach(t => stock[ES.claveStock(c.nombre, t)] = n));
  } else {
    leerStockDelForm();
    coloresEfectivos().forEach(c => talles.forEach(t => { const k = ES.claveStock(c.nombre, t); stock[k] = edit.stock[k] || 0; }));
  }
  const pAnt = Number($('fPrecioAnt').value) || null;
  const p = {
    ...(edit.id ? { id: edit.id } : {}),
    nombre, precio, categoria: edit.categoria,
    precioAnterior: pAnt && pAnt > precio ? pAnt : null,
    descripcion: $('fDescripcion').value.trim(),
    destacado: $('fDestacado').checked, nuevo: $('fNuevo').checked, activo: $('fActivo').checked,
    imagenes: edit.imagenes, colores, talles, stock
  };
  if (JSON.stringify(p).length > 950000) return err('Las fotos pesan demasiado juntas. Sacá alguna.');
  $('prodGuardar').disabled = true;
  try {
    await DB.guardarProducto(p);
    cerrarModal('modalProd');
    ES.toast(edit.id ? 'Producto actualizado ✨' : '¡Producto agregado a la tienda! ✨', 'success');
    productos = await DB.productos(); renderProductos(); if (vista === 'resumen') renderResumen();
  } catch (e2) { err(e2.message); }
  $('prodGuardar').disabled = false;
}

async function borrarProducto(id) {
  const p = productos.find(x => x.id === id);
  if (!confirm(`¿Borrar "${p.nombre}" para siempre?\n\nSi solo no querés que se vea por un tiempo, mejor tocá "Ocultar".`)) return;
  try { await DB.borrarProducto(id); productos = productos.filter(x => x.id !== id); renderProductos(); ES.toast('Producto borrado'); }
  catch (e) { ES.toast(e.message, 'error'); }
}

// ── Mi página: textos, fotos, categorías, horarios, mapa ───────
let paginaSucia = false;
let borrador = null;
const CAMPOS_PAGINA = { pHeroTag: 'heroTag', pHeroTitulo: 'heroTitulo', pHeroTitulo2: 'heroTitulo2', pHeroTexto: 'heroTexto', pBanner: 'bannerTexto', pDireccion: 'direccion', pUbicacion: 'ubicacion', pReferencia: 'referencia', pMapa: 'mapa', pNosTitulo: 'nosotrosTitulo', pNosTexto: 'nosotrosTexto', pInstagram: 'instagram', pFacebook: 'facebook' };

function renderPagina() {
  borrador = { categorias: JSON.parse(JSON.stringify(cats())), horarios: JSON.parse(JSON.stringify(config.horarios || [])) };
  Object.entries(CAMPOS_PAGINA).forEach(([id, k]) => $(id).value = config[k] ?? '');
  $('pWhatsapp').value = mostrarTel(config.whatsapp);
  document.querySelectorAll('#vPagina input, #vPagina textarea').forEach(i => i.oninput = marcarSucia);
  renderFotosPagina(); renderCategoriasAdmin(); renderHorarios(); previsualizarMapa();
  paginaSucia = false; $('paginaEstado').textContent = '';
}
function marcarSucia() { paginaSucia = true; $('paginaEstado').textContent = 'Tenés cambios sin guardar'; }
const mostrarTel = w => { const d = String(w || '').replace(/\D/g, ''); return d.startsWith('549') ? d.slice(3) : d; };
function normalizarTel(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) return '549' + d.slice(2);
  d = d.replace(/^0/, '').replace(/^(\d{2,4})15/, '$1');   // saca el 0 y el 15
  return '549' + d;
}

function fotoSlot(key, etiqueta, max) {
  const src = imagenes[key];
  return `<div class="foto-slot ${src ? 'con' : ''}">
    ${src ? `<img src="${esc(src)}" alt="">` : `<span>📷<small>${esc(etiqueta)}</small></span>`}
    <div class="foto-slot-acc">
      <button type="button" onclick="cambiarFotoPagina('${key}',${max})">${src ? 'Cambiar' : 'Subir foto'}</button>
      ${src ? `<button type="button" class="peligro" onclick="quitarFotoPagina('${key}')">Quitar</button>` : ''}
    </div></div>`;
}
function renderFotosPagina() {
  $('fotosHero').innerHTML = fotoSlot('hero1', 'Foto principal', 1400) + fotoSlot('hero2', 'Foto 2', 900) + fotoSlot('hero3', 'Foto 3', 900);
  $('fotoNosotros').innerHTML = fotoSlot('nosotros', 'Foto del local o de ustedes', 1200);
}
async function cambiarFotoPagina(key, max) {
  const src = await elegirFoto(max); if (!src) return;
  try { await DB.guardarImagen(key, src); imagenes[key] = src; renderFotosPagina(); renderCategoriasAdmin(); ES.toast('Foto guardada ✨', 'success'); }
  catch (e) { ES.toast(e.message, 'error'); }
}
async function quitarFotoPagina(key) {
  if (!confirm('¿Quitar esta foto?')) return;
  try { await DB.guardarImagen(key, null); delete imagenes[key]; renderFotosPagina(); renderCategoriasAdmin(); }
  catch (e) { ES.toast(e.message, 'error'); }
}

// Categorías
function renderCategoriasAdmin() {
  if (!borrador) return;
  $('listaCategorias').innerHTML = borrador.categorias.map((c, i) => {
    const n = productos.filter(p => p.categoria === c.key).length;
    const foto = imagenes['cat_' + c.key];
    return `<div class="adm-cat">
      <button type="button" class="adm-cat-foto" onclick="cambiarFotoPagina('cat_${c.key}',800)" title="Cambiar foto">${foto ? `<img src="${esc(foto)}" alt="">` : '<span>📷</span>'}</button>
      <input class="form-input adm-cat-icono" value="${esc(c.icon || '')}" maxlength="4" title="Dibujito (emoji)" oninput="borrador.categorias[${i}].icon=this.value;marcarSucia()">
      <input class="form-input" value="${esc(c.label)}" placeholder="Nombre" oninput="borrador.categorias[${i}].label=this.value;marcarSucia()">
      <span class="adm-cat-n">${n} prod.</span>
      <div class="adm-cat-acc">
        <button type="button" ${i === 0 ? 'disabled' : ''} onclick="moverCategoria(${i},-1)" title="Subir">↑</button>
        <button type="button" ${i === borrador.categorias.length - 1 ? 'disabled' : ''} onclick="moverCategoria(${i},1)" title="Bajar">↓</button>
        <button type="button" class="peligro" onclick="borrarCategoria(${i})" title="Borrar">🗑</button>
      </div></div>`;
  }).join('');
}
function agregarCategoria() {
  const nombre = (prompt('Nombre de la nueva categoría (ej: Camperas, Lencería, Calzado)') || '').trim(); if (!nombre) return;
  let key = ES.slug(nombre); while (borrador.categorias.some(c => c.key === key)) key += '-2';
  borrador.categorias.push({ key, label: nombre, icon: '✦' });
  renderCategoriasAdmin(); marcarSucia();
}
function moverCategoria(i, d) { const a = borrador.categorias; [a[i], a[i + d]] = [a[i + d], a[i]]; renderCategoriasAdmin(); marcarSucia(); }
function borrarCategoria(i) {
  const c = borrador.categorias[i];
  const n = productos.filter(p => p.categoria === c.key).length;
  if (n) return alert(`"${c.label}" tiene ${n} producto(s). Primero pasalos a otra categoría (editando cada producto) y después la podés borrar.`);
  if (!confirm(`¿Borrar la categoría "${c.label}"?`)) return;
  borrador.categorias.splice(i, 1); renderCategoriasAdmin(); marcarSucia();
}

// Horarios
function renderHorarios() {
  $('listaHorarios').innerHTML = borrador.horarios.map((h, i) => `
    <div class="adm-horario">
      <input class="form-input" value="${esc(h.dias)}" placeholder="Ej: Lunes a Viernes" oninput="borrador.horarios[${i}].dias=this.value;marcarSucia()">
      <input class="form-input" value="${esc(h.horas)}" placeholder="Ej: 9:30 a 12:30 · 16:30 a 20:00" oninput="borrador.horarios[${i}].horas=this.value;marcarSucia()">
      <button type="button" onclick="borrador.horarios.splice(${i},1);renderHorarios();marcarSucia()" aria-label="Quitar">✕</button>
    </div>`).join('');
}
function agregarHorario() { borrador.horarios.push({ dias: '', horas: '' }); renderHorarios(); marcarSucia(); }
function previsualizarMapa() {
  const q = $('pMapa').value.trim() || [$('pDireccion').value, $('pUbicacion').value].filter(Boolean).join(', ');
  const f = $('pMapaFrame'); if (f.dataset.q !== q) { f.src = ES.mapaEmbed(q); f.dataset.q = q; }
}

async function guardarPagina() {
  const c = {};
  Object.entries(CAMPOS_PAGINA).forEach(([id, k]) => c[k] = $(id).value.trim());
  c.whatsapp = normalizarTel($('pWhatsapp').value);
  c.instagram = c.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '');
  c.categorias = borrador.categorias.map(x => ({ ...x, label: x.label.trim() || 'Sin nombre', icon: (x.icon || '').trim() }));
  c.horarios = borrador.horarios.filter(h => h.dias.trim() || h.horas.trim());
  try {
    await DB.guardarConfig(c);
    config = { ...config, ...c };
    paginaSucia = false; $('paginaEstado').textContent = '✓ Guardado';
    $('pWhatsapp').value = mostrarTel(c.whatsapp);
    ES.toast('¡Listo! Ya se ve en la tienda ✨', 'success');
    cargarTodo();
  } catch (e) { ES.toast(e.message, 'error'); }
}

// ── Envíos y pagos ──────────────────────────────────────────────
const CAMPOS = { cCostoEnvio: 'costoEnvio', cGratisDesde: 'envioGratisDesde', cAlias: 'aliasTransferencia', cCuotas: 'cuotasSinInteres' };
const CHECKS = { cRetiro: 'retiroEnLocal', cMP: 'aceptaMercadoPago', cTransf: 'aceptaTransferencia' };
function renderAjustes() {
  Object.entries(CAMPOS).forEach(([id, k]) => $(id).value = config[k] ?? '');
  Object.entries(CHECKS).forEach(([id, k]) => $(id).checked = !!config[k]);
}
async function guardarAjustes(e) {
  e.preventDefault();
  const c = {};
  Object.entries(CAMPOS).forEach(([id, k]) => { const v = $(id).value.trim(); c[k] = $(id).type === 'number' ? (Number(v) || 0) : v; });
  Object.entries(CHECKS).forEach(([id, k]) => c[k] = $(id).checked);
  if (!c.aceptaMercadoPago && !c.aceptaTransferencia) return ES.toast('Dejá al menos un medio de pago activo', 'error');
  try { await DB.guardarConfig(c); config = { ...config, ...c }; ES.toast('Guardado ✨', 'success'); }
  catch (e2) { ES.toast(e2.message, 'error'); }
}
