# Precios Claro — web con actualización automática

Prototipo universitario gratuito para recomendar restaurantes económicos, calcular precios finales sin propina obligatoria, y administrar locales y cartas desde un panel. La web incluye 112 locales ficticios en siete comunas de Santiago para probar exhaustivamente los filtros. Son datos simulados, no recomendaciones reales.

**IMPORTANTE:** Los locales, cartas, precios, fechas y sellos precargados son inventados. El sistema no comprueba automáticamente las cartas de comercios reales ni certifica a ningún restaurante.

## Empieza aquí

**Para que el panel publique cambios automáticamente para todos**, sigue **[GUIA_FIREBASE.md](GUIA_FIREBASE.md)**. La guía explica cómo:

1. Crear un proyecto Firebase de plan gratuito.
2. Crear la base Firestore y publicar las reglas de seguridad incluidas.
3. Autorizar a los editores mediante Firebase Authentication y `admins/UID`.
4. Copiar la configuración pública de Firebase a `firebase-config.js`.
5. Subir esta versión de los archivos a GitHub Pages una sola vez.
6. Entrar al panel, publicar los 112 ejemplos y luego cambiar precios en línea.

No hay que pagar por un dominio ni instalar Node.js. La web sigue en la dirección gratuita de GitHub Pages.

## Dos modos de operación

| | Sin Firebase configurado | Con Firebase configurado |
|---|---|---|
| Búsqueda, cartas, filtro y chatbot | Sí | Sí |
| Panel para editar restaurantes | No, edición bloqueada | Sí, con inicio de sesión |
| Guardar precios | No disponible | En Firestore para todos |
| Otros visitantes ven cambios | No | Sí, automáticamente |
| Autenticación de editor | No | Sí, con permisos por UID |
| Respaldo JSON | Solo datos de muestra | Sí |

Sin Firebase, se puede navegar por el catálogo de muestra, pero el panel editor permanece bloqueado. El acceso requiere cuentas autorizadas de Firebase.

## Funciones

- 112 restaurantes ficticios y cartas de muestra: al menos 3 opciones para cada combinación de comuna, tipo de comida y presupuesto desplegable (sin búsqueda por palabra ni geolocalización).
- Filtros por comuna, presupuesto máximo, tipo de comida y búsqueda por texto.
- Chatbot guiado con botones, sin IA de pago.
- Ubicación opcional desde el navegador para encontrar sectores cercanos; coordenadas de los ejemplos aproximadas.
- Precio del plato con impuestos incluidos + cargos obligatorios registrados = total sin propina. Propina ilustrativa del 10 % calculada por separado.
- Panel para crear, editar y eliminar locales o platos, modificar precios, disponibilidad, enlaces a cartas y fechas de verificación.
- Estado ilustrativo o de revisión registrada, con vencimiento visual después de 30 días; no equivale a una auditoría independiente.
- Sincronización con Firestore para visitantes conectados, sin recargar la web.
- Copias de seguridad JSON y protección de conflictos cuando dos editores trabajan sobre versiones distintas.

## Archivos

| Archivo | Función |
|---|---|
| `index.html` | Página, chatbot, buscador, cartas y panel |
| `estilos.css` | Estilos responsive |
| `app.js` | Búsquedas, cálculos y administración |
| `datos.js` | Datos ficticios de respaldo, visibles antes de la primera publicación en Firestore |
| `firebase-config.js` | Configuración pública de Firebase; inicialmente en `null` |
| `cloud.js` | Firestore en tiempo real y Authentication |
| `firestore.rules` | Reglas que **debes copiar y publicar en Firebase Console** |
| `GUIA_FIREBASE.md` | Instalación segura paso a paso |
| `EMPIEZA_AQUI.txt` | Resumen breve |
| `favicon.svg` | Icono del proyecto |

## Precauciones

El código fuente de GitHub Pages es público. **No publiques contraseñas, claves privadas, tokens o credenciales de servicio.** El objeto `firebaseConfig` del SDK web sí es público; la protección la proporcionan las reglas de Firestore y los permisos de los usuarios. Los campos de los locales publicados también serán públicos; no guardes datos personales ni notas internas privadas.

En esta primera versión, el catálogo online se almacena como un solo documento Firestore. Es suficiente para un prototipo pequeño; para crecer mucho convendrá dividirlo en documentos por establecimiento y agregar auditoría de cambios.


## Actualización de identidad y acceso (noviembre de 2026)

La sección «El sello» describe la propuesta de adhesión voluntaria de locales, transparencia del precio total y revisión periódica, no las funciones internas del software. Todos los restaurantes iniciales son ficticios.

**Edición restringida:** el panel exige una cuenta de Firebase Authentication (correo y contraseña) y autorización del UID en `admins/{uid}` con `active: true`. Sin Firebase configurado, los campos de edición están bloqueados; el público puede seguir explorando locales de muestra. **No se ha creado ninguna contraseña predeterminada**, ni debe ponerse una contraseña en el código público de GitHub. Configura primero Authentication, Firestore y sus reglas según `GUIA_FIREBASE.md`.

El permiso de escritura se valida en `firestore.rules`, no solo ocultando botones. La publicación de las reglas debe hacerse desde la consola de Firebase, ya que GitHub Pages no despliega reglas de Firestore.

## Cobertura de pruebas de filtros (noviembre de 2026)

El catálogo incluye 7 comunas, 5 tipos de comida y 5 presupuestos establecidos más la opción «Sin límite». Contando «Todas» en comuna y tipo, se probaron **288 combinaciones**, con mínimo **3 opciones ficticias** por combinación. El buscador muestra primero 12 resultados y permite «Ver más locales». Una búsqueda por texto arbitrario o ubicación GPS fuera de la zona puede producir cero coincidencias; se mantiene la búsqueda fiel a los criterios elegidos.

**Cuando el equipo elimine locales o modifique precios/categorías desde Firebase, debe volver a comprobar la cobertura.** Estos resultados corresponden únicamente al catálogo ficticio precargado.
