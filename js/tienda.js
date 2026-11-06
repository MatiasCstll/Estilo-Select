/* ============================================================
   ESTILO SELECT — Tienda (páginas, catálogo, carrito, cuenta y checkout)
   ============================================================ */
const { precio: $p, esc } = ES;
const CART_KEY = 'es_v2_carrito';

let productos = [];
let config = { ...(ES_CONFIG.tiendaDefault || {}) };
let imagenes = {};
let carrito = leerCarrito();
let favoritos = [];
let usuario = null;
let busqueda = '';
let filtroTalle = null, filtroColor = null;
let ruta = { vista: 'inicio' };
let pendienteTrasLogin = null;   // acción a retomar después de iniciar sesión

// ── Carrito en el navegador ─────────────────────────────────────
function leerCarrito() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } }
function guardarCarrito() { try { localStorage.setItem(CART_KEY, JSON.stringify(carrito)); } catch { } actualizarCarritoUI(); }
const prodPorId = id => productos.find(p => p.id === id);
const cats = () => ES.categorias(config);
const catDe = key => cats().find(c => c.key === key);
const CAT_LABEL = new Proxy({}, { get: (_, k) => catDe(k)?.label || '' });
const CAT_ICON = new Proxy({}, { get: (_, k) => catDe(k)?.icon || '✦' });
const visibles = () => productos.filter(p => p.activo !== false);
const enOferta = p => p.precioAnterior > p.precio;

// ── Inicio ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (DB.modo === 'demo') document.getElementById('demoBar').classList.remove('hidden');
  actualizarCarritoUI();
  aplicarConfig();
  window.addEventListener('scroll', () => document.getElementById('header').classList.toggle('scrolled', scrollY > 30), { passive: true });
  window.addEventListener('hashchange', () => irA(location.hash));

  document.getElementById('buscador').addEventListener('input', e => { busqueda = e.target.value.trim().toLowerCase(); renderLista(); });
  document.getElementById('orden').addEventListener('change', renderLista);
  document.getElementById('soloOfertas').addEventListener('change', renderLista);
  document.getElementById('authForm').addEventListener('submit', enviarAuth);
  document.getElementById('checkoutForm').addEventListener('submit', confirmarCompra);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); salirDeProducto(); } });
  document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) { m.classList.remove('open'); if (m.id === 'modalProducto') salirDeProducto(); } }));

  DB.onAuth(async u => {
    usuario = u;
    document.getElementById('cuentaLabel').textContent = u ? (u.nombre || 'Mi cuenta').split(' ')[0] : 'Ingresar';
    document.getElementById('btnAdmin').classList.toggle('hidden', !(u && u.esAdmin));
    favoritos = u ? await DB.favoritos().catch(() => []) : [];
    renderVista();
    if (u && pendienteTrasLogin) { const f = pendienteTrasLogin; pendienteTrasLogin = null; f(); }
  });

  try {
    [productos, config, imagenes] = await Promise.all([DB.productos(), DB.config(), DB.imagenes().catch(() => ({}))]);
  } catch (e) {
    console.error(e);
    ES.toast('No se pudo cargar el catálogo. Revisá tu conexión.', 'error');
  }
  aplicarConfig();
  limpiarCarrito();
  irA(location.hash);
  revisarRetornoPago();
});

// ── Textos, fotos y datos del local (todo editable desde el admin) ──
// Colores que se pueden cambiar desde el panel (Mi página → Colores)
const COLOR_VARS = { verde: '--verde-pastel', verdeClaro: '--verde-claro', dorado: '--dorado', crema: '--crema', pie: '--pie-bg', franja: '--franja-bg' };
function aplicarColores() {
  const c = config.colores || {}, r = document.documentElement.style;
  Object.entries(COLOR_VARS).forEach(([k, v]) => { if (c[k]) r.setProperty(v, c[k]); else r.removeProperty(v); });
}
function aplicarSecciones() {
  const s = config.secciones || {};
  document.querySelectorAll('[data-seccion]').forEach(el => el.classList.toggle('sec-off', s[el.dataset.seccion] === false));
}

function aplicarConfig() {
  const $ = id => document.getElementById(id);
  aplicarColores(); aplicarSecciones();
  const bar = $('promoBar');
  bar.textContent = config.bannerTexto || '';
  bar.classList.toggle('hidden', !config.bannerTexto);

  const wa = config.whatsapp ? 'https://wa.me/' + String(config.whatsapp).replace(/\D/g, '') : null;
  document.querySelectorAll('.js-wa-link').forEach(a => { if (wa) { a.href = wa; a.classList.remove('hidden-link'); } else { a.removeAttribute('href'); a.classList.add('hidden-link'); } });
  $('waFab').classList.toggle('hidden', !wa);
  document.querySelectorAll('.js-ig-link').forEach(a => { a.classList.toggle('hidden', !config.instagram); if (config.instagram) a.href = 'https://instagram.com/' + config.instagram.replace('@', ''); });
  const tt = (config.tiktok || '').replace(/^@/, '');
  document.querySelectorAll('.js-tt-link').forEach(a => { a.classList.toggle('hidden', !tt); if (tt) a.href = 'https://www.tiktok.com/@' + tt; });
  const hayRedes = !!(tt || config.instagram);
  const banda = document.getElementById('redesBanda'); if (banda) banda.classList.toggle('hidden', !hayRedes);
  document.querySelectorAll('.js-fb-link').forEach(a => { a.classList.toggle('hidden', !config.facebook); if (config.facebook) a.href = config.facebook; });
  document.querySelectorAll('.js-ubicacion').forEach(s => s.textContent = config.ubicacion || '');

  // Portada
  $('heroTag').textContent = config.heroTag || '';
  $('heroTitulo').textContent = config.heroTitulo || '';
  $('heroTitulo2').textContent = config.heroTitulo2 || '';
  $('heroTexto').textContent = config.heroTexto || '';
  const fotosHero = ['hero1', 'hero2', 'hero3'].map(k => imagenes[k]).filter(Boolean);
  $('heroFotos').className = 'hero2-fotos fotos-' + fotosHero.length;
  $('heroFotos').innerHTML = fotosHero.length
    ? fotosHero.map((src, i) => `<div class="hero2-foto f${i + 1}"><img src="${esc(src)}" alt=""></div>`).join('')
    : `<div class="hero2-foto f1 hero2-foto-vacia"><img src="logo.jpg" alt="Estilo Select"></div>`;

  // Cinta
  const perks = [config.bannerTexto, 'Envíos a todo el país', config.retiroEnLocal ? 'Retiro gratis en el local' : '', config.cuotasSinInteres > 1 ? `${config.cuotasSinInteres} cuotas sin interés` : '', 'Cambios sin vueltas', config.ubicacion].filter(Boolean).flatMap(t => t.split(' · '));
  const fila = [...new Set(perks)].map(t => `<span>${esc(t)}</span><i>✦</i>`).join('');
  $('cinta').innerHTML = fila + fila;

  // Nosotros
  $('nosotrosTitulo').innerHTML = esc(config.nosotrosTitulo || '').replace(/alma/i, m => `<em>${m}</em>`);
  $('nosotrosTexto').innerHTML = String(config.nosotrosTexto || '').split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join('');
  $('nosotrosFoto').innerHTML = imagenes.nosotros ? `<img class="about-img-main" src="${esc(imagenes.nosotros)}" alt="Nuestro local">` : '<div class="about-placeholder">ES</div>';
  const nVis = visibles().length;
  $('statProductos').textContent = nVis > 200 ? '+200' : nVis;
  $('statProductos').parentElement.classList.toggle('hidden', !nVis);
  $('statCategorias').textContent = cats().length;

  // Visitanos + mapa
  $('visDireccion').textContent = config.direccion || '';
  $('visCiudad').textContent = config.ubicacion || '';
  $('visReferencia').textContent = config.referencia || '';
  const horarios = (config.horarios || []).filter(h => h.dias || h.horas);
  $('visHorarios').innerHTML = horarios.map(h => `<div class="visit-horario"><b>${esc(h.dias)}</b><span>${esc(h.horas)}</span></div>`).join('');
  const q = config.mapa || [config.direccion, config.ubicacion].filter(Boolean).join(', ');
  const frame = $('mapaFrame');
  if (frame.dataset.q !== q) { frame.src = ES.mapaEmbed(q); frame.dataset.q = q; }
  $('mapaAbrir').href = ES.mapaLink(q);
  $('btnComoLlegar').href = ES.mapaComoLlegar(q);
  $('footerDireccion').textContent = [config.direccion, config.ubicacion].filter(Boolean).join(' · ');
  $('footerHorarios').innerHTML = horarios.map(h => `<span class="footer-txt">${esc(h.dias)}: ${esc(h.horas)}</span>`).join('<br>');

  renderMenus();
}

// Menú principal, menú del celular y footer con las categorías
function renderMenus() {
  const activo = ruta.vista === 'cat' ? ruta.cat : ruta.vista;
  const links = [
    { href: '#/', label: 'Inicio', id: 'inicio' },
    ...cats().map(c => ({ href: '#/c/' + c.key, label: c.label, id: c.key })),
    ...(visibles().some(enOferta) ? [{ href: '#/ofertas', label: 'Ofertas', id: 'ofertas', cls: 'nav-oferta' }] : []),
    { href: '#/visitanos', label: 'Visitanos', id: 'visitanos' }
  ];
  navLinks = links; navActivo = activo;
  ajustarNav();
  document.getElementById('mobileMenu').innerHTML = links.map(l => `<a href="${l.href}" onclick="toggleMenu()" class="${l.id === activo ? 'activo' : ''}">${esc(l.label)}</a>`).join('') +
    `<a href="#/favoritos" onclick="toggleMenu()">♡ Favoritos</a><a href="#" onclick="toggleMenu();abrirCuenta();return false">Mi cuenta</a>`;
  document.getElementById('footerCats').innerHTML = cats().map(c => `<li><a href="#/c/${c.key}">${esc(c.label)}</a></li>`).join('') + '<li><a href="#/todo">Ver todo</a></li>';
}

// Dibuja la barra con "max" categorías a la vista; el resto va en "Más ▾"
let navLinks = [], navActivo = '';
function dibujarNav(max) {
  const lista = cats(), activo = navActivo, links = navLinks;
  const a = l => `<a href="${l.href}" class="${l.cls || ''} ${l.id === activo ? 'activo' : ''}">${esc(l.label)}</a>`;
  const directas = lista.length > max ? lista.slice(0, max) : lista;
  const resto = lista.slice(directas.length);
  document.getElementById('mainNav').innerHTML = a(links[0]) + directas.map(c => a({ href: '#/c/' + c.key, label: c.label, id: c.key })).join('') +
    (resto.length ? `<div class="nav-mas ${resto.some(c => c.key === activo) ? 'activo' : ''}"><button type="button">${directas.length ? 'Más' : 'Categorías'} ▾</button><div class="nav-mas-menu">${resto.map(c => a({ href: '#/c/' + c.key, label: (c.icon ? c.icon + ' ' : '') + c.label, id: c.key })).join('')}<a href="#/todo">✦ Ver todo</a></div></div>` : '') +
    links.slice(1 + lista.length).map(a).join('');
}
// Achica la barra hasta que entre en la pantalla (sirve con cualquier zoom o tamaño de letra)
function ajustarNav() {
  const header = document.querySelector('header'), inner = document.querySelector('.header-inner');
  if (!header || !inner || !navLinks.length) return;
  header.classList.remove('nav-compacta');
  const n = cats().length;
  for (let max = Math.min(n, 6); max >= 0; max--) {
    dibujarNav(max);
    if (getComputedStyle(document.getElementById('mainNav')).display === 'none') return;
    if (inner.scrollWidth <= inner.clientWidth + 1) return;
  }
  header.classList.add('nav-compacta');
}
let _navT; window.addEventListener('resize', () => { clearTimeout(_navT); _navT = setTimeout(ajustarNav, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ajustarNav());

// Saca del carrito productos que ya no existen y ajusta cantidades al stock
function limpiarCarrito() {
  if (!productos.length) return;
  const antes = JSON.stringify(carrito);
  carrito = carrito.filter(it => { const p = prodPorId(it.pid); return p && p.activo !== false; })
    .map(it => ({ ...it, cant: Math.min(it.cant, ES.stockDe(prodPorId(it.pid), it.color, it.talle)) }))
    .filter(it => it.cant > 0);
  if (JSON.stringify(carrito) !== antes) ES.toast('Actualizamos tu carrito: algunos productos cambiaron de stock.');
  guardarCarrito();
}

// ── Páginas (rutas con #) ───────────────────────────────────────
//  #/            inicio          #/c/remeras   una categoría
//  #/todo        todo            #/ofertas     ofertas
//  #/novedades   lo más nuevo    #/favoritos   favoritos
//  #/visitanos   inicio, bajando al mapa
//  #/p/ID        abre un producto
let vistaAntesDelProducto = '#/';
function irA(hash) {
  const partes = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b] = partes;
  if (a === 'p' && b) {
    if (!ruta.render) mostrarVista({ vista: 'inicio' });
    if (prodPorId(b)) abrirProducto(b);
    else { ES.toast('Ese producto ya no está disponible'); salirDeProducto(); }
    return;
  }
  cerrar('modalProducto');
  let r;
  if (!a) r = { vista: 'inicio' };
  else if (a === 'c' && b) r = catDe(b) ? { vista: 'cat', cat: b } : { vista: 'todo' };
  else if (['todo', 'ofertas', 'novedades', 'favoritos'].includes(a)) r = { vista: a };
  else if (a === 'visitanos') r = { vista: 'inicio', ancla: 'visitanos' };
  else r = { vista: 'inicio' };
  if (r.vista !== ruta.vista || r.cat !== ruta.cat) { busqueda = ''; filtroTalle = filtroColor = null; document.getElementById('buscador').value = ''; document.getElementById('soloOfertas').checked = false; }
  mostrarVista(r);
  vistaAntesDelProducto = location.hash || '#/';
  if (r.ancla) setTimeout(() => document.getElementById(r.ancla).scrollIntoView({ behavior: 'smooth' }), 60);
  else window.scrollTo({ top: 0 });
}

function mostrarVista(r) {
  ruta = { ...r, render: true };
  document.getElementById('vistaInicio').classList.toggle('hidden', r.vista !== 'inicio');
  document.getElementById('vistaLista').classList.toggle('hidden', r.vista === 'inicio');
  document.getElementById('mobileMenu').classList.remove('open');
  renderMenus();
  renderVista();
  const titulo = r.vista === 'cat' ? CAT_LABEL[r.cat] : { todo: 'Toda la colección', ofertas: 'Ofertas', novedades: 'Novedades', favoritos: 'Favoritos' }[r.vista];
  document.title = (titulo ? titulo + ' — ' : '') + 'Estilo Select · Boutique de Moda';
}

function renderVista() { if (ruta.vista === 'inicio') renderInicio(); else renderLista(); }

// ── Página de inicio ────────────────────────────────────────────
function fotoDeCategoria(c) {
  if (imagenes['cat_' + c.key]) return imagenes['cat_' + c.key];
  const p = visibles().find(x => x.categoria === c.key && x.imagenes && x.imagenes[0]);
  return p ? p.imagenes[0] : null;
}
function renderInicio() {
  document.getElementById('catTiles').innerHTML = cats().map((c, i) => {
    const foto = fotoDeCategoria(c);
    const n = visibles().filter(p => p.categoria === c.key).length;
    return `<a class="cat-tile ${foto ? '' : 'sin-foto'}" href="#/c/${c.key}" style="--d:${i * 60}ms">
      ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : `<div class="cat-tile-icono">${esc(c.icon || '✦')}</div>`}
      <div class="cat-tile-info"><h3>${esc(c.label)}</h3><span>${n ? n + ' prenda' + (n === 1 ? '' : 's') : 'Próximamente'} · Ver →</span></div>
    </a>`;
  }).join('');

  const nuevos = visibles().sort((a, b) => (b.nuevo ? 1 : 0) - (a.nuevo ? 1 : 0) || (b.creado || 0) - (a.creado || 0)).slice(0, 8);
  document.getElementById('gridNovedades').innerHTML = nuevos.length ? nuevos.map(renderCard).join('') : vacio('Muy pronto nuevas prendas', 'Estamos preparando la colección.');
  const ofertas = visibles().filter(enOferta).slice(0, 4);
  document.getElementById('seccionOfertas').classList.toggle('hidden', !ofertas.length);
  document.getElementById('gridOfertas').innerHTML = ofertas.map(renderCard).join('');
}

// ── Página de lista (categoría, todo, ofertas...) ───────────────
function baseDeLista() {
  let l = visibles();
  if (ruta.vista === 'cat') l = l.filter(p => p.categoria === ruta.cat);
  if (ruta.vista === 'ofertas') l = l.filter(enOferta);
  if (ruta.vista === 'favoritos') l = l.filter(p => favoritos.includes(p.id));
  if (ruta.vista === 'novedades') l = l.sort((a, b) => (b.creado || 0) - (a.creado || 0)).slice(0, 24);
  return l;
}
function listaFiltrada() {
  const orden = document.getElementById('orden').value;
  const ofertas = document.getElementById('soloOfertas').checked;
  let l = baseDeLista();
  if (ofertas) l = l.filter(enOferta);
  if (filtroTalle) l = l.filter(p => (p.talles || []).includes(filtroTalle) && ((p.colores || []).length ? p.colores.some(c => ES.stockDe(p, c.nombre, filtroTalle) > 0) : ES.stockDe(p, null, filtroTalle) > 0));
  if (filtroColor) l = l.filter(p => (p.colores || []).some(c => c.nombre === filtroColor));
  if (busqueda) l = l.filter(p => [p.nombre, p.descripcion, CAT_LABEL[p.categoria], ...(p.colores || []).map(c => c.nombre)].join(' ').toLowerCase().includes(busqueda));
  const sinStock = p => ES.stockTotal(p) <= 0 ? 1 : 0;
  const cmp = {
    relevancia: (a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0) || (b.creado || 0) - (a.creado || 0),
    nuevos: (a, b) => (b.creado || 0) - (a.creado || 0),
    menor: (a, b) => a.precio - b.precio,
    mayor: (a, b) => b.precio - a.precio,
    az: (a, b) => a.nombre.localeCompare(b.nombre)
  }[orden];
  return l.sort((a, b) => sinStock(a) - sinStock(b) || cmp(a, b));
}

function renderLista() {
  if (ruta.vista === 'inicio') return;
  const c = ruta.vista === 'cat' ? catDe(ruta.cat) : null;
  const titulos = { todo: ['Toda la colección', 'Estilo Select'], ofertas: ['Ofertas', 'Aprovechá'], novedades: ['Novedades', 'Recién llegados'], favoritos: ['Tus favoritos', 'Lo que más te gustó'] };
  const [titulo, sub] = c ? [c.label, 'Colección'] : titulos[ruta.vista];
  document.getElementById('listaTitulo').textContent = titulo;
  document.getElementById('listaSub').textContent = sub;
  document.getElementById('listaMiga').textContent = titulo;
  const foto = c ? fotoDeCategoria(c) : null;
  const banner = document.getElementById('listaBanner');
  banner.style.setProperty('--banner-img', foto ? `url("${foto.replace(/"/g, '%22')}")` : 'none');
  banner.classList.toggle('con-foto', !!foto);

  const activo = ruta.vista === 'cat' ? ruta.cat : ruta.vista;
  document.getElementById('catPills').innerHTML = [{ key: 'todo', label: 'Todo', icon: '✦', href: '#/todo' }, ...cats().map(x => ({ ...x, href: '#/c/' + x.key })),
  ...(visibles().some(enOferta) ? [{ key: 'ofertas', label: 'Ofertas', icon: '🏷️', href: '#/ofertas' }] : [])]
    .map(x => `<a class="cat-pill ${x.key === activo ? 'active' : ''}" href="${x.href}">${esc(x.icon || '')} ${esc(x.label)}</a>`).join('');

  // Filtros de talle y color con lo que hay en esta página
  const base = baseDeLista();
  const talles = [...new Set(base.flatMap(p => p.talles || []))];
  const colores = [...new Map(base.flatMap(p => p.colores || []).map(x => [x.nombre, x])).values()];
  document.getElementById('filtrosExtra').innerHTML =
    (talles.length > 1 ? `<div class="filtro-grupo"><span>Talle</span>${talles.map(t => `<button class="filtro-talle ${t === filtroTalle ? 'on' : ''}" onclick="setFiltroTalle(${esc(JSON.stringify(t))})">${esc(t)}</button>`).join('')}</div>` : '') +
    (colores.length > 1 ? `<div class="filtro-grupo"><span>Color</span>${colores.map(x => `<button class="filtro-color ${x.nombre === filtroColor ? 'on' : ''}" title="${esc(x.nombre)}" style="--sw:${esc(x.hex)}" onclick="setFiltroColor(${esc(JSON.stringify(x.nombre))})"><i></i></button>`).join('')}</div>` : '') +
    ((filtroTalle || filtroColor) ? `<button class="link-btn" style="margin:0" onclick="filtroTalle=filtroColor=null;renderLista()">Limpiar filtros ✕</button>` : '');

  const l = listaFiltrada();
  document.getElementById('listaCuenta').textContent = `${l.length} prenda${l.length === 1 ? '' : 's'}`;
  document.getElementById('productosGrid').innerHTML = l.length ? l.map(renderCard).join('') :
    ruta.vista === 'favoritos' && !usuario ? vacio('Guardá tus favoritos', 'Ingresá y tocá el ♡ en las prendas que te gusten.')
      : vacio(base.length ? 'No encontramos prendas con esos filtros' : 'Muy pronto en esta sección', base.length ? 'Probá con otro talle, color o búsqueda.' : 'Estamos preparando nuevas prendas. ¡Volvé pronto!');
}
function setFiltroTalle(t) { filtroTalle = filtroTalle === t ? null : t; renderLista(); }
function setFiltroColor(c) { filtroColor = filtroColor === c ? null : c; renderLista(); }
const vacio = (t, s) => `<div class="no-products"><div class="icon">✦</div><h3>${esc(t)}</h3><p>${esc(s)}</p><a class="btn-secondary" style="display:inline-block;margin-top:1.25rem" href="#/todo">Ver toda la colección</a></div>`;

// ── Tarjetas ────────────────────────────────────────────────────
function placeholder(p, cls = '') {
  const c = (p.colores && p.colores[0] && p.colores[0].hex) || '#c4dbd3';
  return `<div class="card-img-placeholder ${cls}" style="--ph:${esc(c)}"><span class="ph-icono">${esc(CAT_ICON[p.categoria])}</span><span class="ph-nombre">${esc(p.nombre || '')}</span></div>`;
}
function imgHtml(p, cls = '') {
  const src = (p.imagenes && p.imagenes[0]) || p.imagen;
  return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(p.nombre)}" loading="lazy">` : placeholder(p, cls);
}

function renderCard(p) {
  const agotado = ES.stockTotal(p) <= 0;
  const oferta = enOferta(p);
  const desc = oferta ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
  const fav = favoritos.includes(p.id);
  const badge = agotado ? '<span class="card-badge badge-agotado">Sin stock</span>'
    : oferta ? `<span class="card-badge badge-oferta">-${desc}%</span>`
      : p.nuevo ? '<span class="card-badge">Nuevo</span>' : '';
  const fotos = p.imagenes || [];
  const img = fotos[1] ? `${imgHtml(p)}<img class="img-hover" src="${esc(fotos[1])}" alt="" loading="lazy">` : imgHtml(p);
  const colores = (p.colores || []).slice(0, 6).map(c => `<span class="swatch-mini" style="background:${esc(c.hex)}" title="${esc(c.nombre)}"></span>`).join('');
  const cuotas = config.cuotasSinInteres > 1 ? `<div class="card-cuotas">${config.cuotasSinInteres} cuotas sin interés de ${$p(p.precio / config.cuotasSinInteres)}</div>` : '';
  return `
    <div class="product-card ${agotado ? 'agotado' : ''}" role="listitem">
      <a class="card-img-wrap" href="#/p/${p.id}">
        ${img}
        ${badge}
        <button class="fav-btn ${fav ? 'on' : ''}" onclick="event.preventDefault();event.stopPropagation();toggleFav('${p.id}')" aria-label="Favorito">${fav ? '♥' : '♡'}</button>
        <span class="card-ver">${agotado ? 'Ver' : 'Ver y elegir talle'}</span>
      </a>
      <div class="card-body">
        <div class="card-cat">${esc(CAT_LABEL[p.categoria] || p.categoria)}</div>
        <a class="card-name" href="#/p/${p.id}">${esc(p.nombre)}</a>
        <div class="card-swatches">${colores}</div>
        <div class="card-precio">${oferta ? `<s>${$p(p.precioAnterior)}</s>` : ''}${$p(p.precio)}</div>
        ${cuotas}
      </div>
    </div>`;
}

// ── Detalle de producto ─────────────────────────────────────────
let sel = { pid: null, color: null, talle: null, cant: 1, foto: 0 };

// El producto se abre con la dirección #/p/ID (así se puede compartir el link)
function cerrarProducto() { cerrar('modalProducto'); salirDeProducto(); }
function salirDeProducto() {
  if (/^#\/p\//.test(location.hash)) history.replaceState(null, '', vistaAntesDelProducto || '#/');
}
function abrirProducto(id) {
  const p = prodPorId(id); if (!p) return;
  if (!/^#\/p\//.test(location.hash)) history.replaceState(null, '', '#/p/' + id);
  const colores = p.colores || [];
  // Elegir por defecto el primer color con stock
  const colorOk = colores.find(c => (p.talles || []).some(t => ES.stockDe(p, c.nombre, t) > 0));
  sel = { pid: id, color: colorOk ? colorOk.nombre : (colores[0]?.nombre || null), talle: null, cant: 1, foto: 0 };
  if ((p.talles || []).length === 1) sel.talle = p.talles[0];
  renderProducto();
  abrir('modalProducto');
}

function renderProducto() {
  const p = prodPorId(sel.pid); if (!p) return;
  const fotos = (p.imagenes && p.imagenes.length) ? p.imagenes : (p.imagen ? [p.imagen] : []);
  const oferta = p.precioAnterior > p.precio;
  const stockSel = sel.talle ? ES.stockDe(p, sel.color, sel.talle) : null;
  const fav = favoritos.includes(p.id);

  const galeria = fotos.length ? `
      <div class="pd-foto-main"><img src="${esc(fotos[sel.foto] || fotos[0])}" alt="${esc(p.nombre)}"></div>
      ${fotos.length > 1 ? `<div class="pd-thumbs">${fotos.map((f, i) => `<button class="${i === sel.foto ? 'on' : ''}" onclick="sel.foto=${i};renderProducto()"><img src="${esc(f)}" alt=""></button>`).join('')}</div>` : ''}`
    : `<div class="pd-foto-main">${imgHtml(p)}</div>`;

  const colores = (p.colores || []).map((c, i) => {
    const hay = (p.talles || []).some(t => ES.stockDe(p, c.nombre, t) > 0);
    return `<button class="swatch ${c.nombre === sel.color ? 'on' : ''} ${hay ? '' : 'off'}" style="--sw:${esc(c.hex)}" title="${esc(c.nombre)}" onclick="selColor(${i})"><span></span></button>`;
  }).join('');

  const talles = (p.talles || []).map((t, i) => {
    const s = ES.stockDe(p, sel.color, t);
    return `<button class="talle-btn ${t === sel.talle ? 'on' : ''}" ${s <= 0 ? 'disabled' : ''} onclick="selTalle(${i})">${esc(t)}</button>`;
  }).join('');

  let stockTxt = '';
  if (sel.talle) stockTxt = stockSel <= 0 ? '<span class="stock-no">Sin stock en esta combinación</span>'
    : stockSel <= 3 ? `<span class="stock-poco">¡Últimas ${stockSel} unidades!</span>` : '<span class="stock-ok">✓ Disponible</span>';

  document.getElementById('pdContenido').innerHTML = `
    <div class="pd-galeria">${galeria}</div>
    <div class="pd-info">
      <div class="card-cat">${esc(CAT_LABEL[p.categoria] || '')}</div>
      <h2 class="pd-nombre">${esc(p.nombre)}</h2>
      <div class="pd-precio">${oferta ? `<s>${$p(p.precioAnterior)}</s>` : ''}${$p(p.precio)}</div>
      ${config.cuotasSinInteres > 1 ? `<div class="card-cuotas">💳 ${config.cuotasSinInteres} cuotas sin interés de ${$p(p.precio / config.cuotasSinInteres)}</div>` : ''}
      <p class="pd-desc">${esc(p.descripcion || '')}</p>
      ${colores ? `<div class="pd-label">Color: <b>${esc(sel.color || '')}</b></div><div class="pd-swatches">${colores}</div>` : ''}
      ${talles ? `<div class="pd-label">Talle: <b>${esc(sel.talle || 'elegí uno')}</b></div><div class="pd-talles">${talles}</div>` : ''}
      <div class="pd-stock">${stockTxt}</div>
      <div class="pd-acciones">
        <div class="qty">
          <button onclick="cambiarCantSel(-1)" aria-label="Menos">−</button>
          <span>${sel.cant}</span>
          <button onclick="cambiarCantSel(1)" aria-label="Más">+</button>
        </div>
        <button class="btn-form-submit" onclick="agregarSeleccion()" ${sel.talle && stockSel <= 0 ? 'disabled' : ''}>Agregar al carrito</button>
        <button class="fav-btn-lg ${fav ? 'on' : ''}" onclick="toggleFav('${p.id}')" aria-label="Favorito">${fav ? '♥' : '♡'}</button>
      </div>
      ${usuario && usuario.esAdmin ? `<a class="pd-editar" href="admin.html#editar=${p.id}">✎ Editar este producto</a>` : ''}
      <button class="pd-compartir" onclick="compartirProducto('${p.id}')">↗ Compartir</button>
      <ul class="pd-perks">
        <li>🚚 Envío ${config.envioGratisDesde ? `gratis desde ${$p(config.envioGratisDesde)}` : 'a todo el país'}</li>
        ${config.retiroEnLocal ? '<li>🏬 Retiro gratis en el local</li>' : ''}
        <li>🔄 Primer cambio sin cargo</li>
      </ul>
    </div>`;
}

function selColor(i) { const p = prodPorId(sel.pid); sel.color = p.colores[i].nombre; sel.cant = 1; if (sel.talle && ES.stockDe(p, sel.color, sel.talle) <= 0) sel.talle = null; renderProducto(); }
function selTalle(i) { const p = prodPorId(sel.pid); sel.talle = p.talles[i]; sel.cant = 1; renderProducto(); }

async function compartirProducto(id) {
  const p = prodPorId(id); const url = location.href.split('#')[0] + '#/p/' + id;
  try {
    if (navigator.share) await navigator.share({ title: p.nombre + ' — Estilo Select', url });
    else { await navigator.clipboard.writeText(url); ES.toast('Link copiado 📋', 'success'); }
  } catch { }
}

function cambiarCantSel(d) {
  const p = prodPorId(sel.pid);
  const max = sel.talle ? ES.stockDe(p, sel.color, sel.talle) : 99;
  sel.cant = Math.max(1, Math.min(sel.cant + d, max === Infinity ? 99 : max));
  renderProducto();
}

function agregarSeleccion() {
  const p = prodPorId(sel.pid);
  if ((p.colores || []).length && !sel.color) return ES.toast('Elegí un color', 'error');
  if ((p.talles || []).length && !sel.talle) return ES.toast('Elegí un talle', 'error');
  const talle = sel.talle || 'Única';
  const max = ES.stockDe(p, sel.color, talle);
  const ex = carrito.find(it => it.pid === p.id && it.color === sel.color && it.talle === talle);
  const enCarrito = ex ? ex.cant : 0;
  if (enCarrito + sel.cant > max) return ES.toast(`Solo quedan ${max} unidades de esta combinación`, 'error');
  if (ex) ex.cant += sel.cant; else carrito.push({ pid: p.id, color: sel.color, talle, cant: sel.cant });
  guardarCarrito();
  cerrarProducto();
  ES.toast(`"${p.nombre}" agregado al carrito 🛍️`, 'success');
  setTimeout(toggleCarrito, 250);
}

// ── Favoritos ───────────────────────────────────────────────────
async function toggleFav(pid) {
  if (!usuario) { pendienteTrasLogin = () => toggleFav(pid); ES.toast('Ingresá para guardar tus favoritos'); return abrirAuth('login'); }
  try {
    favoritos = await DB.toggleFavorito(pid);
    renderVista();
    if (document.getElementById('modalProducto').classList.contains('open')) renderProducto();
    if (document.getElementById('modalCuenta').classList.contains('open')) cuentaTab('favoritos');
  } catch (e) { ES.toast(e.message, 'error'); }
}

// ── Carrito ─────────────────────────────────────────────────────
function totales() {
  const subtotal = carrito.reduce((s, it) => s + (prodPorId(it.pid)?.precio || 0) * it.cant, 0);
  return { subtotal, unidades: carrito.reduce((s, it) => s + it.cant, 0) };
}
function costoEnvio(subtotal, tipo) {
  if (tipo !== 'envio') return 0;
  if (config.envioGratisDesde && subtotal >= config.envioGratisDesde) return 0;
  return Number(config.costoEnvio) || 0;
}

function toggleCarrito() {
  const abierto = document.getElementById('cartSidebar').classList.toggle('open');
  document.getElementById('cartOverlay').classList.toggle('open', abierto);
  document.body.classList.toggle('no-scroll', abierto);
}

function actualizarCarritoUI() {
  const { subtotal, unidades } = totales();
  const cnt = document.getElementById('cartCount');
  cnt.textContent = unidades; cnt.classList.toggle('visible', unidades > 0);
  document.getElementById('cartTotal').textContent = $p(subtotal);
  document.getElementById('btnCheckout').disabled = !carrito.length;

  const prog = document.getElementById('cartEnvioProgreso');
  if (config.envioGratisDesde && carrito.length) {
    const falta = config.envioGratisDesde - subtotal;
    const pct = Math.min(100, subtotal / config.envioGratisDesde * 100);
    prog.innerHTML = `<div>${falta > 0 ? `Te faltan <b>${$p(falta)}</b> para el envío gratis` : '🎉 ¡Tenés envío gratis!'}</div><div class="barra"><i style="width:${pct}%"></i></div>`;
    prog.classList.remove('hidden');
  } else prog.classList.add('hidden');

  const cont = document.getElementById('cartItems');
  if (!carrito.length) {
    cont.innerHTML = `<div class="cart-empty"><div class="icon">🛍️</div><p>Tu carrito está vacío.</p><p style="font-size:.82rem;margin-top:.5rem">¡Explorá nuestra colección!</p></div>`;
    return;
  }
  cont.innerHTML = carrito.map((it, i) => {
    const p = prodPorId(it.pid); if (!p) return '';
    const max = ES.stockDe(p, it.color, it.talle);
    return `
      <div class="cart-item">
        <div class="cart-item-img">${imgHtml(p)}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${esc(p.nombre)}</div>
          <div class="cart-item-cat">${it.color ? esc(it.color) + ' · ' : ''}Talle ${esc(it.talle)}</div>
          <div class="cart-item-row">
            <div class="qty qty-sm">
              <button onclick="cambiarCant(${i},-1)" aria-label="Menos">−</button>
              <span>${it.cant}</span>
              <button onclick="cambiarCant(${i},1)" ${it.cant >= max ? 'disabled' : ''} aria-label="Más">+</button>
            </div>
            <div class="cart-item-price">${$p(p.precio * it.cant)}</div>
          </div>
        </div>
        <button class="cart-item-remove" onclick="quitarItem(${i})" aria-label="Quitar">✕</button>
      </div>`;
  }).join('');
}

function cambiarCant(i, d) {
  const it = carrito[i]; if (!it) return;
  const max = ES.stockDe(prodPorId(it.pid), it.color, it.talle);
  it.cant = Math.min(max, it.cant + d);
  if (it.cant <= 0) carrito.splice(i, 1);
  guardarCarrito();
}
function quitarItem(i) { carrito.splice(i, 1); guardarCarrito(); }

// ── Modales ─────────────────────────────────────────────────────
function abrir(id) { document.getElementById(id).classList.add('open'); }
function cerrar(id) { document.getElementById(id).classList.remove('open'); }
function toggleMenu() { document.getElementById('mobileMenu').classList.toggle('open'); }

function mostrarInfo(titulo, html) {
  document.getElementById('infoTitulo').textContent = titulo;
  document.getElementById('infoCuerpo').innerHTML = html;
  abrir('modalInfo');
}
function abrirInfo(cual) {
  const envio = config.envioGratisDesde ? `Envío gratis en compras desde <b>${$p(config.envioGratisDesde)}</b>. ` : '';
  const textos = {
    envios: ['Envíos', `<p>Hacemos envíos a todo el país. ${envio}Para compras menores el envío cuesta <b>${$p(config.costoEnvio)}</b>.</p>${config.retiroEnLocal ? '<p style="margin-top:.75rem">También podés retirar gratis por el local en nuestros horarios de atención.</p>' : ''}`],
    cambios: ['Cambios y devoluciones', '<p>Tenés 30 días para cambiar tu prenda, sin uso y con etiqueta. El primer cambio no tiene costo. Escribinos por WhatsApp con tu número de pedido.</p>'],
    pagos: ['Medios de pago', `<p>${config.aceptaMercadoPago ? `Mercado Pago: tarjetas de crédito y débito, dinero en cuenta y efectivo en Rapipago/Pago Fácil${config.cuotasSinInteres > 1 ? `, con hasta ${config.cuotasSinInteres} cuotas sin interés` : ''}.` : ''}</p>${config.aceptaTransferencia ? '<p style="margin-top:.75rem">También transferencia bancaria o efectivo en el local.</p>' : ''}`]
  };
  mostrarInfo(...textos[cual]);
}

// ── Cuenta: login / registro ────────────────────────────────────
let modoAuth = 'login';
function abrirAuth(modo = 'login') { authTab(modo); document.getElementById('authError').classList.add('hidden'); abrir('modalAuth'); setTimeout(() => document.getElementById(modo === 'registro' ? 'aNombre' : 'aEmail').focus(), 100); }
function authTab(modo) {
  modoAuth = modo;
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === modo));
  document.querySelectorAll('.solo-registro').forEach(e => e.classList.toggle('hidden', modo !== 'registro'));
  document.querySelectorAll('.solo-login').forEach(e => e.classList.toggle('hidden', modo !== 'login'));
  document.getElementById('authTitulo').textContent = modo === 'login' ? 'Ingresar' : 'Crear cuenta';
  document.getElementById('authSubmit').textContent = modo === 'login' ? 'Ingresar' : 'Crear cuenta';
  document.getElementById('aPass').autocomplete = modo === 'login' ? 'current-password' : 'new-password';
}
function errorAuth(msg) { const e = document.getElementById('authError'); e.textContent = msg; e.classList.remove('hidden'); }

async function enviarAuth(ev) {
  ev.preventDefault();
  const nombre = document.getElementById('aNombre').value.trim();
  const email = document.getElementById('aEmail').value.trim();
  const pass = document.getElementById('aPass').value;
  if (!email || !pass) return errorAuth('Completá email y contraseña.');
  if (modoAuth === 'registro' && !nombre) return errorAuth('Contanos tu nombre.');
  const btn = document.getElementById('authSubmit'); btn.disabled = true;
  try {
    if (modoAuth === 'login') await DB.login(email, pass); else await DB.registro(nombre, email, pass);
    cerrar('modalAuth');
    document.getElementById('aPass').value = '';
    ES.toast(modoAuth === 'login' ? '¡Bienvenida de nuevo! ✨' : '¡Cuenta creada! ✨', 'success');
  } catch (e) { errorAuth(e.message); }
  btn.disabled = false;
}
async function loginGoogle() {
  try { await DB.loginGoogle(); cerrar('modalAuth'); ES.toast('¡Hola! ✨', 'success'); } catch (e) { errorAuth(e.message); }
}
async function recuperarPass() {
  const email = document.getElementById('aEmail').value.trim();
  if (!email) return errorAuth('Escribí tu email y tocá de nuevo "¿Olvidaste tu contraseña?".');
  try { await DB.recuperar(email); ES.toast('Te mandamos un email para cambiar la contraseña', 'success'); } catch (e) { errorAuth(e.message); }
}
async function logout() { await DB.logout(); cerrar('modalCuenta'); ES.toast('Sesión cerrada'); }

// ── Mi cuenta ───────────────────────────────────────────────────
function abrirCuenta() {
  if (!usuario) return abrirAuth('login');
  document.getElementById('cuentaNombre').textContent = (usuario.nombre || '').split(' ')[0];
  document.getElementById('cuentaEmail').textContent = usuario.email || '';
  cuentaTab('pedidos');
  abrir('modalCuenta');
}

function chipEstado(e) { const s = ES.ESTADOS[e] || { label: e, color: '#999' }; return `<span class="chip-estado" style="--c:${s.color}">${s.label}</span>`; }

async function cuentaTab(tab) {
  document.querySelectorAll('[data-ctab]').forEach(b => b.classList.toggle('active', b.dataset.ctab === tab));
  const cont = document.getElementById('cuentaContenido');
  if (tab === 'favoritos') {
    const l = productos.filter(p => favoritos.includes(p.id));
    cont.innerHTML = l.length ? `<div class="mini-grid">${l.map(p => `
      <div class="mini-card" onclick="cerrar('modalCuenta');location.hash='#/p/${p.id}'">${imgHtml(p)}<div><b>${esc(p.nombre)}</b><span>${$p(p.precio)}</span></div></div>`).join('')}</div>`
      : '<div class="cart-empty"><div class="icon">♡</div><p>Todavía no guardaste favoritos.</p></div>';
    return;
  }
  cont.innerHTML = '<p class="texto-suave">Cargando pedidos...</p>';
  try {
    const peds = await DB.misPedidos();
    cont.innerHTML = peds.length ? peds.map(pd => `
      <div class="pedido-card">
        <div class="pedido-head"><b>Pedido #${esc(pd.numero || pd.id.slice(-6).toUpperCase())}</b>${chipEstado(pd.estado)}</div>
        <div class="texto-suave" style="font-size:.8rem">${ES.fecha(pd.creado)} · ${pd.entrega?.tipo === 'envio' ? 'Envío a domicilio' : 'Retiro en el local'}</div>
        <ul class="pedido-items">${(pd.items || []).map(it => `<li>${it.cant}× ${esc(it.nombre)} <span class="texto-suave">(${it.color ? esc(it.color) + ', ' : ''}${esc(it.talle)})</span></li>`).join('')}</ul>
        <div class="pedido-foot"><span>Total <b>${$p(pd.total)}</b></span>
          ${pd.estado === 'pendiente' && pd.metodoPago === 'mp' ? `<button class="btn-agregar-carrito" onclick="pagarPedido('${pd.id}')">Pagar ahora</button>` : ''}
        </div>
      </div>`).join('') : '<div class="cart-empty"><div class="icon">📦</div><p>Todavía no hiciste pedidos.</p></div>';
  } catch (e) { cont.innerHTML = `<p class="form-error">No se pudieron cargar tus pedidos. ${esc(e.message)}</p>`; }
}

// ── Checkout ────────────────────────────────────────────────────
let coEntrega = 'envio', coPago = 'mp', coCupon = null;

async function aplicarCupon() {
  const inp = document.getElementById('coCuponInput'); const cod = inp.value.trim().toUpperCase();
  if (!cod) return;
  try {
    const cup = await DB.cupon(cod);
    const r = ES.calcularCupon(cup, totales().subtotal);
    if (r.error) ES.toast(r.error, 'error');
    else { coCupon = cup; inp.value = ''; ES.toast('¡Cupón aplicado! 🎉', 'success'); }
  } catch (e) { ES.toast('No pudimos revisar el cupón. Probá de nuevo.', 'error'); }
  renderCheckout();
}
function quitarCupon() { coCupon = null; renderCheckout(); }
function descuentoActual(subtotal) {
  if (!coCupon) return 0;
  const r = ES.calcularCupon(coCupon, subtotal);
  if (r.error) { coCupon = null; return 0; }
  return r.descuento;
}

function irAlCheckout() {
  if (!carrito.length) return;
  if (!usuario) { pendienteTrasLogin = irAlCheckout; ES.toast('Ingresá o creá tu cuenta para terminar la compra'); return abrirAuth('registro'); }
  toggleCarrito();
  document.getElementById('coNombre').value ||= usuario.nombre || '';
  document.getElementById('coEmail').value ||= usuario.email || '';
  coEntrega = config.retiroEnLocal ? (coEntrega || 'envio') : 'envio';
  coPago = config.aceptaMercadoPago ? 'mp' : 'transferencia';
  renderCheckout();
  document.getElementById('coError').classList.add('hidden');
  abrir('modalCheckout');
}

function renderCheckout() {
  const { subtotal } = totales();
  const envio = costoEnvio(subtotal, coEntrega);
  const opt = (grupo, val, actual, titulo, sub) => `
    <label class="opcion ${val === actual ? 'on' : ''}"><input type="radio" name="${grupo}" value="${val}" ${val === actual ? 'checked' : ''} onchange="${grupo === 'entrega' ? 'coEntrega' : 'coPago'}='${val}';renderCheckout()">
      <div><b>${titulo}</b><span>${sub}</span></div></label>`;

  const envioTxt = (config.envioGratisDesde && subtotal >= config.envioGratisDesde) ? '¡Gratis!' : $p(config.costoEnvio);
  document.getElementById('coEntregaOpciones').innerHTML =
    opt('entrega', 'envio', coEntrega, 'Envío a domicilio', envioTxt) +
    (config.retiroEnLocal ? opt('entrega', 'retiro', coEntrega, 'Retiro en el local', 'Gratis · ' + esc([config.direccion, config.ubicacion].filter(Boolean).join(', '))) : '');
  document.getElementById('coDireccion').classList.toggle('hidden', coEntrega !== 'envio');

  document.getElementById('coPagoOpciones').innerHTML =
    (config.aceptaMercadoPago ? opt('pago', 'mp', coPago, 'Mercado Pago', 'Tarjeta, débito, dinero en cuenta' + (config.cuotasSinInteres > 1 ? ` · hasta ${config.cuotasSinInteres} cuotas sin interés` : '')) : '') +
    (config.aceptaTransferencia ? opt('pago', 'transferencia', coPago, 'Transferencia o efectivo', 'Coordinamos por WhatsApp') : '');

  document.getElementById('coItems').innerHTML = carrito.map(it => {
    const p = prodPorId(it.pid); if (!p) return '';
    return `<div class="co-item"><div class="co-item-img">${imgHtml(p)}<span>${it.cant}</span></div><div><b>${esc(p.nombre)}</b><small>${it.color ? esc(it.color) + ' · ' : ''}${esc(it.talle)}</small></div><span>${$p(p.precio * it.cant)}</span></div>`;
  }).join('');
  const desc = descuentoActual(subtotal);
  document.getElementById('coSubtotal').textContent = $p(subtotal);
  document.getElementById('coDescLinea').classList.toggle('hidden', !desc);
  document.getElementById('coDesc').textContent = '− ' + $p(desc);
  const ok = document.getElementById('coCuponOk');
  ok.classList.toggle('hidden', !coCupon);
  if (coCupon) ok.innerHTML = `🏷️ Cupón <b>${esc(coCupon.codigo)}</b> (${coCupon.tipo === 'monto' ? $p(coCupon.valor) : coCupon.valor + '%'} off) <button type="button" class="link-btn" onclick="quitarCupon()">Quitar</button>`;
  document.getElementById('coEnvio').textContent = coEntrega === 'envio' ? (envio ? $p(envio) : 'Gratis') : 'Gratis';
  document.getElementById('coTotal').textContent = $p(subtotal - desc + envio);
  document.getElementById('coSubmit').textContent = coPago === 'mp' ? 'Ir a pagar con Mercado Pago' : 'Confirmar pedido';
  document.querySelector('.co-seguro').classList.toggle('hidden', coPago !== 'mp');
}

async function confirmarCompra(ev) {
  ev.preventDefault();
  const v = id => document.getElementById(id).value.trim();
  const err = m => { const e = document.getElementById('coError'); e.textContent = m; e.classList.remove('hidden'); };
  if (!v('coNombre') || !v('coTel') || !v('coEmail')) return err('Completá tus datos de contacto.');
  if (!/^\S+@\S+\.\S+$/.test(v('coEmail'))) return err('Revisá el email.');
  if (coEntrega === 'envio' && (!v('coCalle') || !v('coCiudad') || !v('coCP'))) return err('Completá la dirección de envío.');
  if (!carrito.length) return err('Tu carrito está vacío.');

  // Volver a leer stock y precios por si cambiaron mientras comprabas
  const btn = document.getElementById('coSubmit'); btn.disabled = true; btn.textContent = 'Procesando...';
  try {
    productos = await DB.productos();
    for (const it of carrito) {
      const p = prodPorId(it.pid);
      if (!p || p.activo === false) throw new Error('Un producto de tu carrito ya no está disponible.');
      if (ES.stockDe(p, it.color, it.talle) < it.cant) throw new Error(`No hay stock suficiente de "${p.nombre}" (${it.color || ''} ${it.talle}).`);
    }
    const { subtotal } = totales();
    const envio = costoEnvio(subtotal, coEntrega);
    const descuento = descuentoActual(subtotal);
    const pedido = {
      uid: usuario.uid,
      email: usuario.email || v('coEmail'),
      cliente: { nombre: v('coNombre'), telefono: v('coTel'), email: v('coEmail') },
      entrega: coEntrega === 'envio'
        ? { tipo: 'envio', direccion: v('coCalle'), ciudad: v('coCiudad'), cp: v('coCP'), notas: v('coNotas') }
        : { tipo: 'retiro', notas: v('coNotas') },
      items: carrito.map(it => { const p = prodPorId(it.pid); return { pid: p.id, nombre: p.nombre, precio: p.precio, color: it.color || null, talle: it.talle, cant: it.cant }; }),
      subtotal, envio, descuento, cupon: descuento ? coCupon.codigo : null, total: subtotal - descuento + envio,
      metodoPago: coPago,
      estado: 'pendiente'
    };
    const id = await DB.crearPedido(pedido);
    carrito = []; guardarCarrito(); coCupon = null;
    cerrar('modalCheckout');
    if (coPago === 'mp') await pagarPedido(id);
    else mostrarConfirmacionManual(id, pedido);
  } catch (e) { err(e.message); }
  btn.disabled = false; renderCheckout();
}

// Crea el pago en Mercado Pago (en el servidor) y manda al cliente a pagar
async function pagarPedido(id) {
  if (DB.modo === 'demo') {
    mostrarInfo('Pago simulado (modo demo)', `<p>Acá la clienta iría a Mercado Pago. Como la tienda está en modo demo, podés simular el resultado:</p>
      <div class="form-actions"><button class="btn-form-cancel" onclick="cerrar('modalInfo')">Dejar pendiente</button>
      <button class="btn-form-submit" onclick="simularPago('${id}')">Simular pago aprobado</button></div>`);
    return;
  }
  ES.toast('Conectando con Mercado Pago...');
  try {
    const token = await DB.idToken();
    const r = await fetch((ES_CONFIG.apiBase || '/api') + '/crear-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ pedidoId: id })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago.');
    location.href = data.url;
  } catch (e) {
    mostrarInfo('No pudimos abrir Mercado Pago', `<p>${esc(e.message)}</p><p style="margin-top:.75rem">Tu pedido quedó guardado. Podés intentar de nuevo desde <a href="#" class="link-dorado" onclick="cerrar('modalInfo');abrirCuenta();return false">Mis pedidos</a>.</p>`);
  }
}
async function simularPago(id) {
  await DB.pagarDemo(id);
  productos = await DB.productos(); renderVista();
  cerrar('modalInfo');
  mostrarExito(id);
}

function mensajeWhatsApp(id, pd) {
  const lineas = pd.items.map(it => `• ${it.cant}x ${it.nombre} (${it.color ? it.color + ', ' : ''}${it.talle}) ${$p(it.precio * it.cant)}`).join('\n');
  return `¡Hola! Hice el pedido #${id.slice(-6).toUpperCase()} en Estilo Select:\n${lineas}${pd.descuento ? `\nCupón ${pd.cupon}: -${$p(pd.descuento)}` : ''}\nTotal: ${$p(pd.total)}\nEntrega: ${pd.entrega.tipo === 'envio' ? pd.entrega.direccion + ', ' + pd.entrega.ciudad : 'Retiro en el local'}\nNombre: ${pd.cliente.nombre}`;
}

function mostrarConfirmacionManual(id, pd) {
  const wa = config.whatsapp ? `https://wa.me/${String(config.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(mensajeWhatsApp(id, pd))}` : null;
  mostrarInfo('¡Pedido recibido! ✨', `
    <p>Tu pedido <b>#${esc(id.slice(-6).toUpperCase())}</b> quedó registrado por <b>${$p(pd.total)}</b>.</p>
    ${config.aliasTransferencia ? `<p style="margin-top:.75rem">Podés transferir al alias <b>${esc(config.aliasTransferencia)}</b> y mandarnos el comprobante.</p>` : ''}
    <p style="margin-top:.75rem">Te reservamos las prendas. Escribinos para coordinar el pago y la entrega:</p>
    ${wa ? `<a class="btn-primary btn-wa" href="${wa}" target="_blank" rel="noopener">Enviar pedido por WhatsApp</a>` : ''}`);
}

function mostrarExito(id) {
  mostrarInfo('¡Gracias por tu compra! 🎉', `
    <p>Recibimos el pago de tu pedido <b>#${esc(String(id).slice(-6).toUpperCase())}</b>. Te avisamos por email y WhatsApp cuando esté en camino.</p>
    <div class="form-actions"><button class="btn-form-submit" onclick="cerrar('modalInfo');abrirCuenta()">Ver mis pedidos</button></div>`);
}

// Cuando Mercado Pago devuelve a la clienta a la tienda
function revisarRetornoPago() {
  const q = new URLSearchParams(location.search);
  const pago = q.get('pago'), id = q.get('pedido');
  if (!pago || !id) return;
  history.replaceState(null, '', location.pathname);
  if (pago === 'ok') mostrarExito(id);
  else if (pago === 'pendiente') mostrarInfo('Pago en proceso ⏳', '<p>Mercado Pago está procesando tu pago. Apenas se acredite, tu pedido pasa a "Pagado" en Mis pedidos.</p>');
  else mostrarInfo('El pago no se completó', `<p>No se pudo cobrar. Tu pedido quedó guardado: podés intentar de nuevo con otro medio desde Mis pedidos.</p>
    <div class="form-actions"><button class="btn-form-submit" onclick="cerrar('modalInfo');pagarPedido('${esc(id)}')">Reintentar pago</button></div>`);
}
