/* Precios Claro: conexión al catálogo compartido Firebase.
 * Se carga como módulo ES sin herramientas de compilación; compatible con GitHub Pages.
 * Los permisos de edición NO dependen de esta interfaz, sino de firestore.rules.
 */
const config = window.PRECIOS_CLARO_FIREBASE_CONFIG;
if (config && config.apiKey && config.projectId && config.appId) {
  try {
    const version = '12.5.0';
    const [{initializeApp}, authLib, storeLib] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
    ]);
    const app = initializeApp(config);
    const auth = authLib.getAuth(app);
    const firestore = storeLib.getFirestore(app);
    const catalogRef = storeLib.doc(firestore, 'public', 'catalog');
    let unsubscribeCatalog = null;
    let unsubscribeAuth = null;
    let loggedUser = null;
    let permitted = false;

    const messages = {
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/invalid-email': 'El formato del correo es inválido.',
      'auth/too-many-requests': 'Demasiados intentos. Inténtalo más tarde.',
      'auth/network-request-failed': 'No se pudo conectar. Revisa tu internet.'
    };
    const friendlyError = e => messages[e?.code] || e?.message || 'No se pudo completar la operación.';

    window.PC_CLOUD = {
      start({onCatalog, onCatalogError, onAuth}) {
        if (unsubscribeCatalog) unsubscribeCatalog();
        if (unsubscribeAuth) unsubscribeAuth();
        unsubscribeCatalog = storeLib.onSnapshot(catalogRef, snap => {
          onCatalog(snap.exists() ? snap.data() : null);
        }, onCatalogError);
        unsubscribeAuth = authLib.onAuthStateChanged(auth, async (user) => {
          loggedUser = user;
          permitted = false;
          let error = '';
          if (user) {
            try {
              // En las reglas, cada editor solo puede leer su propio registro de permiso.
              const editorRef = storeLib.doc(firestore, 'admins', user.uid);
              const record = await storeLib.getDoc(editorRef);
              permitted = record.exists() && record.data()?.active === true;
            } catch(e) { error = friendlyError(e); }
          }
          // Evita que una consulta anterior de permisos habilite una sesión ya cerrada.
          if (auth.currentUser?.uid !== user?.uid) return;
          onAuth({email:user?.email || '', uid:user?.uid || '', permitted, error});
        }, error => onAuth({email:'', uid:'', permitted:false, error:friendlyError(error)}));
      },
      async signIn(email, password) {
        try { await authLib.signInWithEmailAndPassword(auth, email, password); }
        catch (error) { throw new Error(friendlyError(error)); }
      },
      async signOut() { await authLib.signOut(auth); },
      async publish(nextCatalog, expectedRevision) {
        if (!loggedUser || !permitted || loggedUser.uid !== auth.currentUser?.uid) {
          throw new Error('Inicia sesión con una cuenta autorizada para publicar.');
        }
        const estimatedBytes = new TextEncoder().encode(JSON.stringify(nextCatalog)).length;
        if (estimatedBytes > 850000) {
          throw new Error('El catálogo es demasiado grande para este prototipo. Hay que dividirlo en varios documentos.');
        }
        // Transacción: detecta cambios de otros editores en vez de sobrescribirlos.
        try {
          return await storeLib.runTransaction(firestore, async tx => {
            const snap = await tx.get(catalogRef);
            const revision = snap.exists() ? Number(snap.data().revision || 0) : 0;
            if (revision !== expectedRevision) throw new Error('CONFLICTO_DE_VERSION');
            const published = {...nextCatalog, revision: revision + 1, updatedAt: new Date().toISOString()};
            tx.set(catalogRef, published);
            return published;
          });
        } catch(error) {
          if (error?.message === 'CONFLICTO_DE_VERSION') {
            throw new Error('Otro editor actualizó los datos. Pulsa “Recargar versión actual” en el editor y vuelve a aplicar el cambio antes de guardar.');
          }
          throw new Error(friendlyError(error));
        }
      }
    };
    window.dispatchEvent(new Event('precios-claro-cloud-ready'));
  } catch(error) {
    window.dispatchEvent(new CustomEvent('precios-claro-cloud-error', {detail: String(error?.message || error)}));
  }
}