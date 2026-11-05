/* ============================================================
   ESTILO SELECT — Configuración
   ------------------------------------------------------------
   1) Mientras "firebase.apiKey" esté vacío, la tienda funciona en
      MODO DEMO: todo se guarda en este navegador (sirve para probar).
   2) Cuando crees tu proyecto en Firebase, pegá acá los datos que te
      da la consola (Configuración del proyecto → Tus apps → Web).
      Estos datos NO son secretos: está bien que estén en la página.
   3) Las claves secretas (Mercado Pago, cuenta de servicio) van SOLO
      en Vercel → Settings → Environment Variables. Nunca acá.
   ============================================================ */
window.ES_CONFIG = {
  firebase: {
    apiKey: "AIzaSyAvdCPr-H4WTfp2VLpi7gslKuzuQKd-_n8",
    authDomain: "estilo-select.firebaseapp.com",
    projectId: "estilo-select",
    storageBucket: "estilo-select.firebasestorage.app",
    messagingSenderId: "625806679174",
    appId: "1:625806679174:web:836b4cefdc3ed4d97dc507"
  },

  // Dirección de la API de pagos. Si la página y la API están en el
  // mismo proyecto de Vercel, dejalo como "/api".
  apiBase: "/api",

  // Valores iniciales de la tienda. Después se cambian desde
  // Panel Admin → Ajustes (y quedan guardados en la base de datos).
  tiendaDefault: {
    // Contacto
    whatsapp: "",            // con código de país, sin + ni espacios. Ej: 5493772555123
    instagram: "",           // usuario sin @
    facebook: "",            // link completo
    tiktok: "",              // usuario sin @

    // Local (sección "Visitanos" y mapa)
    ubicacion: "Paso de los Libres, Corrientes",
    direccion: "Maestro Llanes y Hipólito Yrigoyen",
    referencia: "Local en esquina, con un ventanal grande",
    // Lo que se busca en Google Maps. Si el pin no cae justo en el local, poné las
    // coordenadas (ej: "-29.7123, -57.0876") desde Panel Admin → Mi página → Visitanos.
    mapa: "Maestro Llanes y Hipólito Yrigoyen, Paso de los Libres, Corrientes, Argentina",
    horarios: [
      { dias: "Lunes a Viernes", horas: "9:30 a 12:30  ·  16:30 a 20:00" },
      { dias: "Sábados", horas: "10:00 a 13:00  ·  16:00 a 19:00" }
    ],

    // Textos de la portada y "Nosotros"
    heroTag: "Nueva colección 2026",
    heroTitulo: "Elegancia que",
    heroTitulo2: "te define",
    heroTexto: "Descubrí nuestra selección de moda femenina pensada para cada momento. Prendas con carácter, estilo y calidad premium.",
    nosotrosTitulo: "Moda con alma y estilo propio",
    nosotrosTexto: "En Estilo Select creemos que cada prenda cuenta una historia. Seleccionamos cuidadosamente cada artículo para que encuentres lo que realmente te representa.\n\nCalidad, diseño y atención personalizada son los pilares de nuestra boutique. Porque vestirse bien es una forma de quererse.",

    // Categorías (se agregan, renombran y ordenan desde Panel Admin → Mi página)
    categorias: [
      { key: "remeras", label: "Remeras", icon: "👕" },
      { key: "polleras", label: "Polleras", icon: "👗" },
      { key: "pantalones", label: "Pantalones", icon: "👖" },
      { key: "vestidos", label: "Vestidos", icon: "👒" },
      { key: "buzos", label: "Buzos", icon: "🧥" },
      { key: "accesorios", label: "Accesorios", icon: "👜" }
    ],

    // Envíos y pagos
    costoEnvio: 4500,
    envioGratisDesde: 80000,
    retiroEnLocal: true,
    aceptaMercadoPago: true,
    aceptaTransferencia: true,
    aliasTransferencia: "",
    cuotasSinInteres: 3,
    bannerTexto: "Envío gratis en compras desde $80.000 · 3 cuotas sin interés"
  }
};
