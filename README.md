# Precios Claro

Prototipo universitario para buscar opciones económicas de comida, consultar cartas, conocer precios finales y administrar restaurantes desde un panel.

**Demostración:** los ocho restaurantes, cartas, precios, ubicaciones y sellos son ficticios. No se han verificado locales reales.

## Cómo ver la web

1. En GitHub: **Settings → Pages → Build and deployment**.
2. En **Source**, elige **Deploy from a branch**.
3. Selecciona **main** y **/(root)**, luego guarda.
4. Cuando esté disponible, la dirección será: https://jmarchantvillegas-hub.github.io/precios-claro/

## Cómo habilitar la actualización automática

Sigue [GUIA_FIREBASE.md](GUIA_FIREBASE.md) para conectar Firebase Firestore y Authentication. Antes de configurarlo, el sitio funciona con datos de demostración y edición local; las modificaciones hechas desde el panel **no se sincronizan entre usuarios**.

**No subas contraseñas ni claves privadas al repositorio.** La configuración pública del SDK web va en `firebase-config.js`; los permisos deben configurarse en Firestore.

- [Guía de inicio](LEEME.md)
- [Guía detallada de Firebase](GUIA_FIREBASE.md)
- [Instrucciones breves](EMPIEZA_AQUI.txt)
