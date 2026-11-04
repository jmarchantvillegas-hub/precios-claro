# PRECIOS CLARO — Publicación automática sin editar GitHub

Esta versión añade **Firestore (datos compartidos en tiempo real)** y **Firebase Authentication (inicio de sesión para editores)**, sin contratar dominio ni cambiar el hosting de GitHub Pages. **Los ejemplos ficticios permanecen ficticios**.

## Resultado esperado

- **Visitantes:** abren tu web, ven el catálogo online y las actualizaciones de precios sin recargar.
- **Editores autorizados:** entran a **Panel editor**, ingresan su correo y contraseña, cambian platos/precios y pulsan **Guardar cambios**; la información se publica directamente en Firestore.
- **Sin conectar Firebase:** la web sigue funcionando como demostración local. El panel permite editar en ese navegador; los cambios no se comparten.

## Paso 1. Crear un proyecto Firebase gratis

1. Abre <https://console.firebase.google.com/> e inicia sesión con tu cuenta de Google.
2. Pulsa **Crear un proyecto** y asígnale un nombre, por ejemplo `precios-claro-universidad`. Google Analytics es opcional; no se necesita para este proyecto.
3. En el panel, elige **Agregar app** con el icono **Web** (`</>`), registra un nombre y termina el asistente. **No necesitas activar Firebase Hosting** porque la página seguirá en GitHub Pages.
4. Copia el objeto que aparece como `firebaseConfig`. Debe contener `apiKey`, `authDomain`, `projectId`, `appId` y normalmente `messagingSenderId`. **Esta configuración web es pública, no una contraseña**.
5. Abre el archivo `firebase-config.js` del proyecto, sustituye `null` por el objeto. Por ejemplo:

```javascript
window.PRECIOS_CLARO_FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY_WEB",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  appId: "TU_APP_ID",
  messagingSenderId: "TU_SENDER_ID"
};
```

**No copies literalmente los valores `TU_…`: deben ser los que da tu consola. Nunca incluyas contraseñas, claves privadas, credenciales de cuentas de servicio, ni tokens en este archivo.**

## Paso 2. Activar Firestore y colocar las reglas SEGURAS

1. En Firebase Console ve a **Firestore Database** y elige **Crear base de datos**.
2. Puedes elegir **modo de producción**. Selecciona la ubicación más adecuada y crea la base.
3. Abre la pestaña **Reglas (Rules)** y **reemplaza las reglas** existentes por TODO el contenido del archivo **`firestore.rules`** incluido en el ZIP.
4. Pulsa **Publicar** en la consola. Es obligatorio hacerlo; **poner `firestore.rules` en GitHub no aplica las reglas automáticamente**.
5. Estas reglas permiten la lectura pública de `public/catalog` y bloquean la escritura a quien no esté en la colección de editores autorizados. No utilices reglas como `allow read, write: if true`.

## Paso 3. Crear un editor con contraseña

1. En Firebase Console entra en **Authentication → Sign-in method** y habilita **Correo electrónico/contraseña**.
2. En **Authentication → Users (Usuarios)** elige **Add user / Agregar usuario**. Crea un usuario con tu correo y una contraseña fuerte (puedes crear uno por integrante del equipo).
3. Copia el **UID** del usuario desde la lista de usuarios. El UID es un identificador largo; no es el correo.
4. En Firestore Database, pestaña **Datos**, crea la colección **`admins`** y un **documento cuyo identificador sea exactamente el UID** copiado.
5. Crea en ese documento un campo llamado **`active`**, de tipo **boolean** (no texto) con valor **`true`**. Guarda.
6. Para autorizar compañeros, repite los pasos 2–5 con el UID de cada uno. Para retirar permisos, cambia `active` a `false` o elimina el documento correspondiente desde la consola.

**Muy importante:** no crees documentos `admins` desde la web pública. Las reglas incluidas prohíben que un usuario se conceda permisos a sí mismo. Solo el responsable del proyecto Firebase debe gestionar esos permisos en la consola.

## Paso 4. Subir la versión nueva a GitHub Pages (solo esta vez)

1. Sube los archivos actualizados del ZIP a la raíz de tu repositorio GitHub Pages: `index.html`, `app.js`, `estilos.css`, `cloud.js`, `firebase-config.js`, `datos.js`, `favicon.svg`, etc. Mantén los nombres.
2. Confirma el commit y espera a que GitHub Pages publique esta versión (la web sigue teniendo un enlace del tipo `https://TU_USUARIO.github.io/precios-claro/`).
3. En Firebase Authentication → Settings → **Authorized domains**, si es necesario, agrega `TU_USUARIO.github.io` (solo el host, sin `https://` ni la ruta `/precios-claro/`).
4. Abre la web y comprueba que el indicador superior diga **«Catálogo online actualizado»** o **«Demo aún no publicada»**, no «Modo local» ni «Sin conexión».

## Paso 5. Publicar los datos ficticios iniciales y probar

1. En la web, pulsa **Panel editor** e inicia sesión con el correo y contraseña que creaste en Authentication.
2. Si Firestore aún no tiene un catálogo, verás el botón **☁ Publicar locales de ejemplo en Firebase**. Púlsalo una sola vez.
3. El indicador superior debe mostrar **«Catálogo online actualizado»**.
4. Abre la misma URL desde **otro celular o una ventana privada**, sin iniciar sesión: ambos mostrarán los mismos ocho locales ficticios.
5. En el primer navegador, entra al panel, cambia el precio de un plato de ejemplo y pulsa **Guardar cambios**.
6. Comprueba que el otro dispositivo muestre el valor nuevo **automáticamente sin reemplazar archivos en GitHub**. También puedes agregar o eliminar locales y productos.

## ¿Cómo se manejan los cambios simultáneos?

El catálogo de esta versión se guarda como **un documento** (`public/catalog`), adecuado para esta tarea y decenas de restaurantes pequeños. Incluye un número de revisión y la web usa una transacción: si otra persona cambió los datos mientras estabas editando, **rechaza tu guardado** en vez de sobrescribir silenciosamente su trabajo. En el editor pulsa **«↻ Recargar versión actual»** (descarta tus cambios no guardados) y vuelve a aplicar el cambio sobre el catálogo actualizado.

La sincronización usa un observador en tiempo real (`onSnapshot`). Mantener la página abierta consume lecturas de Firestore; el plan gratuito tiene límites. Como el catálogo es un solo documento, el prototipo también está limitado por el tamaño máximo permitido por Firestore (aprox. 1 MiB por documento). Cuando escale, convendrá guardar **cada restaurante en un documento independiente**.

## ¿Cuánto cuesta?

- GitHub Pages para el sitio público: sin costo en un repositorio público, sujeto a sus condiciones.
- Firebase plan **Spark**: no requiere tarjeta de crédito, ofrece cuotas gratuitas de Firestore, por ejemplo 50.000 lecturas y 20.000 escrituras al día (consulta límites vigentes en Firebase). Si superas límites del plan gratis, el servicio puede dejar de responder hasta restablecerse la cuota; no se cobrarán excedentes sin activar facturación.
- Authentication con correo/contraseña: disponible en el plan gratuito bajo condiciones de uso.

Verifica límites actualizados en <https://firebase.google.com/pricing> y <https://firebase.google.com/docs/firestore/pricing>.

## Seguridad y límites importantes

- **No hay registro público de editores**. Solo usuarios creados y autorizados manualmente pueden editar.
- El catálogo completo es **público**, incluidas las notas y evidencias del panel; no pongas datos personales ni información interna privada en ellos.
- La configuración Firebase web (`apiKey`, `projectId`, etc.) **sí puede estar en el frontend**; los permisos reales se controlan en Firestore Rules.
- **Los datos ficticios no se verifican automáticamente**. «Revisado» es un campo que declara el editor, no una auditoría real.
- La sincronización automática se refiere a **publicar los cambios que tú guardes**. No obtiene automáticamente precios nuevos de restaurantes reales: esos valores todavía los debe ingresar y verificar el equipo.
- Cualquier miembro que haya iniciado sesión y tenga `active: true` puede publicar; sus cambios serán públicos de inmediato. Hagan respaldos con **Respaldo JSON** antes de cambios mayores.
- Si Firefox/Chrome bloquea el servicio desde `file://`, prueba primero en la URL HTTPS de GitHub Pages.
- Para usar `firestore.rules` en producción, evalúa controles adicionales de validación y auditoría según el volumen y sensibilidad de datos.

## Si algo falla

| Síntoma | Revisión |
|---|---|
| «Modo local» | `firebase-config.js` sigue con `null`, o faltan propiedades del objeto. |
| «No se cargó Firebase» | Revisa la conexión, versión de SDK y la consola del navegador. |
| «Sin conexión a Firebase» | Firestore no está creado, las reglas no están publicadas o la configuración es incorrecta. |
| «Cuenta sin permiso» | Revisa que `admins/UID` tenga `active` boolean = `true`; UID debe coincidir con el del usuario autenticado. |
| Error `permission-denied` al guardar | Revisa `firestore.rules`, el UID del editor y el campo `active`. |
| Otro editor actualizó los datos | Pulsa «Recargar versión actual» y aplica el cambio de nuevo. Se descartan los cambios no guardados de ese formulario. |
| Los visitantes siguen viendo valores antiguos | Comprueba que la web indique «Catálogo online actualizado» y que todos estén apuntando al mismo proyecto Firebase. |

Fuentes oficiales: <https://firebase.google.com/docs/auth/web/password-auth>, <https://firebase.google.com/docs/firestore/security/rules-conditions>, <https://firebase.google.com/docs/firestore/query-data/listen>.