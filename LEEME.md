# Estilo Select — Tienda online

La misma página de siempre (verde pastel, dorado y crema), ahora como tienda completa:

- **Una página por categoría:** tocás Remeras y ves solo remeras, tocás Pantalones y ves solo pantalones. Cada página tiene su foto de portada, filtros por talle y color, y se puede compartir el link (por ejemplo `tu-tienda.vercel.app/#/c/vestidos`).
- **Mapa del local** (Maestro Llanes y Hipólito Yrigoyen, Paso de los Libres) con botón "Cómo llegar" que abre Google Maps.
- **Catálogo** con fotos, colores, talles, stock por color y talle, ofertas, buscador y orden.
- **Carrito** que queda guardado, con barra de "te faltan $X para el envío gratis".
- **Cuentas** con email y contraseña o Google: mis pedidos y favoritos.
- **Checkout** con envío a domicilio o retiro en el local, y pago con **Mercado Pago** o transferencia (por WhatsApp).
- **Panel admin** (`admin.html`), pensado para usarlo sin saber de computación:
  - **Productos:** "Agregar producto" en 6 pasos con botones: fotos, nombre y precio, colores (se tocan), talles (se tocan), stock (un solo número o por color y talle) y descripción.
  - **Mi página:** cambiar las fotos y textos de la portada, las categorías (agregar, sacar, ordenar, foto y emoji), dirección, horarios, mapa, "Nosotros", WhatsApp e Instagram.
  - **Pedidos** con cambio de estado y botón para descargarlos a Excel. **Envíos y pagos** (costo de envío, envío gratis, cuotas, alias).
  - **Clientas:** lista armada sola con los pedidos (cuánto compró cada una, WhatsApp, descarga a Excel).
  - **Cupones:** códigos de descuento en % o en $, con compra mínima y vencimiento. El servidor los vuelve a revisar antes de cobrar.
  - **Edición rápida de productos:** tabla para cambiar precios, ocultar o marcar como nuevo, y subir o bajar precios de golpe por categoría.
  - **Mi página → Qué se muestra / Colores:** prender o apagar secciones del inicio y cambiar los colores (con botón para volver a los originales).
- **Servidor** (`api/`): crea el pago en Mercado Pago con los precios reales de la base y, cuando Mercado Pago confirma, marca el pedido como pagado y descuenta el stock.

## Probarla ya (modo demo)

Abrí `index.html` con doble clic. Mientras `js/config.js` no tenga los datos de Firebase, todo se guarda en tu navegador y el pago se simula. Creá una cuenta en la tienda y con esa misma cuenta entrás al panel (`admin.html`).

## Ponerla online (una sola vez, unos 30 minutos)

### 1. Firebase (base de datos y cuentas)
1. Entrá a https://console.firebase.google.com y creá un proyecto, por ejemplo `estilo-select`.
2. **Authentication → Comenzar →** activá **Correo electrónico/contraseña** y **Google**.
3. **Firestore Database → Crear base de datos** (ubicación `southamerica-east1`, modo producción).
4. **Firestore → Reglas:** pegá todo el contenido de `firestore.rules` y tocá **Publicar**. (Cada vez que se actualiza `firestore.rules`, pegalas de nuevo. La última versión agrega los **cupones**.)
5. **Configuración del proyecto → Tus apps → Web (</>)**. Copiá los datos de `firebaseConfig` y pegalos en `js/config.js`.
6. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada.** Se descarga un `.json`. **Ese archivo es secreto:** no lo subas a GitHub ni se lo mandes a nadie. Lo vas a pegar en Vercel (paso 3).

### 2. Mercado Pago
1. Entrá a https://www.mercadopago.com.ar/developers/panel/app y creá una aplicación ("Pagos online", "Checkout Pro").
2. En **Credenciales de prueba** copiá el **Access Token** (empieza con `TEST-`) para probar. Cuando todo funcione, cambiás al de **Credenciales de producción** (`APP_USR-`).
3. Las cuotas sin interés se activan en tu cuenta de Mercado Pago (Tu negocio → Costos → Cuotas sin interés). El número en Ajustes es solo lo que muestra la tienda.

### 3. GitHub + Vercel (hosting y servidor)
1. Subí la carpeta `tienda` a un repo nuevo de GitHub (por ejemplo `estilo-select`).
2. En https://vercel.com → **Add New → Project** → elegí el repo → **Deploy**.
3. En Vercel → **Settings → Environment Variables** cargá:
   - `FIREBASE_SERVICE_ACCOUNT` → pegá **todo** el contenido del `.json` del paso 1.6
   - `MP_ACCESS_TOKEN` → el Access Token de Mercado Pago
   - `SITE_URL` → la dirección de tu tienda, por ejemplo `https://estilo-select.vercel.app`
   - `MP_WEBHOOK_SECRET` (opcional, más seguridad) → en Mercado Pago, en tu app, **Webhooks → Configurar notificaciones**, poné `https://TU-TIENDA/api/webhook-mp`, evento **Pagos**, y copiá la clave secreta que te da.
4. **Deployments → Redeploy** para que tome las variables.
5. En Firebase → **Authentication → Configuración → Dominios autorizados** agregá tu dominio de Vercel (para que funcione el botón de Google).

### 4. Hacerte administradora
1. Entrá a la tienda online y creá tu cuenta.
2. En Firebase → **Authentication → Usuarios** copiá tu **UID**.
3. En **Firestore → Iniciar colección** → nombre `admins` → ID del documento: tu UID → un campo cualquiera, por ejemplo `nombre: "Mati"`. Guardar.
4. Recargá la tienda: aparece el botón **⚙ Admin**.
5. En el panel cargá los productos reales y completá **Mi página** (WhatsApp, Instagram, fotos) y **Envíos y pagos**.

### Si el pin del mapa no cae justo en la esquina
En Google Maps mantené apretado el punto exacto del local, copiá los números que aparecen (por ejemplo `-29.7139, -57.0877`) y pegalos en **Mi página → Visitanos → Ubicación en el mapa**. La vista previa se actualiza ahí mismo.

### 5. Probar un pago
Con el token de prueba hacé una compra y pagá con una tarjeta de prueba de Mercado Pago (https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards). El pedido tiene que pasar solo a **Pagado** y el stock tiene que bajar.

## Cómo está armado

| Archivo | Para qué |
|---|---|
| `index.html`, `styles.css`, `js/tienda.js` | La tienda |
| `admin.html`, `admin.css`, `js/admin.js` | El panel admin |
| `js/config.js` | Datos públicos de Firebase y valores iniciales |
| `js/data.js` | Habla con Firebase (o con el navegador en modo demo) |
| `api/crear-pago.js` | Crea el pago en Mercado Pago con los precios reales |
| `api/webhook-mp.js` | Recibe la confirmación de Mercado Pago, marca el pedido y descuenta stock |
| `firestore.rules` | Quién puede leer y escribir cada cosa |

**Seguridad:** el navegador nunca puede marcar un pedido como pagado ni cambiar precios ni stock. Eso lo hace solo el servidor después de consultar a Mercado Pago. En pedidos por transferencia, revisá el comprobante antes de despachar.

**Al subir cambios de código:** sumale 1 al `?v=3` de los `<link>` y `<script>` en `index.html` y `admin.html`, así los navegadores bajan la versión nueva.
