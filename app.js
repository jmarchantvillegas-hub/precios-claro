/* Precios Claro — GitHub Pages + Firebase opcional.
 * Sin Firebase: edición local. Con Firebase: login + publicación online segura.
 */
(() => {
  'use strict';

  const KEY = 'precios_claro_borrador_v1';
  const $ = (id) => document.getElementById(id);
  const money = (amount) => new Intl.NumberFormat('es-CL', {style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(amount)||0);
  const html = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const published = clone(window.PRECIOS_CLARO_DATA || {version:1,updatedAt:'',places:[]});
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const niceDate = (value) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) return 'Sin revisión registrada'; const [y,m,d]=value.split('-'); return `${d}/${m}/${y}`; };
  const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const normalize = (str) => String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isSafeURL = (value) => { try { const x=new URL(value); return ['https:','http:'].includes(x.protocol) ? x.href : ''; } catch {return '';} };
  const dishTotal = (dish) => Math.max(0,Number(dish.price)||0) + Math.max(0,Number(dish.mandatoryFee)||0);
  const isMeal = dish => dish.available !== false && (dish.category || '').toLowerCase() !== 'bebida' && (dish.category || '').toLowerCase() !== 'postre';
  const cheapDish = (r) => (r.menu||[]).filter(isMeal).sort((a,b)=>dishTotal(a)-dishTotal(b))[0] || null;
  const statusOf = (r) => {
    if(r.status !== 'verificado') return r.status==='pendiente' ? {text:'En revisión',className:'wait'} : {text:'Sello ilustrativo',className:''};
    const when = Date.parse((r.verifiedAt||'')+'T12:00:00Z');
    const days = (Date.now()-when)/86400000;
    if (!Number.isFinite(days) || days>30 || days < -1 || !(r.evidence||'').trim()) return {text:'Revisión vencida',className:'wait'};
    return {text:'Revisión vigente*',className:'valid'};
  };
  const validData = (data) => Boolean(data && data.version===1 && Array.isArray(data.places) && data.places.length<=500 && data.places.every(r =>
    r && typeof r.id==='string' && typeof r.name==='string' && typeof r.comuna==='string' && Array.isArray(r.menu) && r.menu.length<=100 &&
    r.menu.every(d => d && typeof d.id==='string' && typeof d.name==='string' && Number.isFinite(Number(d.price)) && Number(d.price)>=0 && Number.isFinite(Number(d.mandatoryFee||0)) && Number(d.mandatoryFee||0)>=0)
  ));

  const cloudConfigured = Boolean(window.PRECIOS_CLARO_FIREBASE_CONFIG?.apiKey && window.PRECIOS_CLARO_FIREBASE_CONFIG?.projectId && window.PRECIOS_CLARO_FIREBASE_CONFIG?.appId);
  let db = clone(published);
  // Un borrador viejo no debe reemplazar el catálogo online.
  if (!cloudConfigured) {
    try { const saved=JSON.parse(localStorage.getItem(KEY)); if(validData(saved)) db=saved; } catch(e){ console.warn('No fue posible abrir el borrador.',e); }
  }
  let cloudApi = null, cloudReady = false, cloudHasCatalog = false, cloudRevision = 0;
  let cloudIsAdmin = false, cloudEmail = '', cloudLoginPending = false;
  let editingRevision = 0;
  let activePlaceId = null;
  let selectedDishId = null;
  let editing = null;
  let activeEditId = null;
  let userPosition = null;
  let geoOnly = false;
  let toastTimer = null;
  let chatPhase = 'budget';
  let messages = [];

  function persist(){
    db.updatedAt=today();
    try {localStorage.setItem(KEY,JSON.stringify(db)); } catch(e){showToast('No se pudo guardar el borrador en este navegador. Exporta un respaldo.',true);}
    updatePreviewLabel();
  }
  function updatePreviewLabel(){
    const strip=document.querySelector('.demo-strip');
    if(!strip) return;
    strip.textContent='✦ PROTOTIPO UNIVERSITARIO · Todos los locales iniciales son ficticios · Ningún sello inicial es real' +
      (cloudConfigured ? (cloudHasCatalog ? ' · CATÁLOGO COMPARTIDO ONLINE' : ' · DEMO LOCAL HASTA PUBLICAR EN FIREBASE') : (hasDraft()?' · VISTA PREVIA DE CAMBIOS LOCALES':''));
  }
  function hasDraft(){try{return !!localStorage.getItem(KEY);}catch{return false;}}
  function showToast(text,problem=false){
    const toast=$('toast'); toast.textContent=text; toast.style.background=problem?'#a13e37':'#164e3d'; toast.hidden=false;
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.hidden=true,4200);
  }
  function scrollExplore(){ $('explorar').scrollIntoView({behavior:'smooth',block:'start'}); }
  function kmBetween(a,b,c,d){const R=6371,rad=Math.PI/180,dx=(c-a)*rad,dy=(d-b)*rad,x=Math.sin(dx/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dy/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
  function distanceFor(r){if(!userPosition || !Number.isFinite(Number(r.lat)) || !Number.isFinite(Number(r.lon)) || r.lat===null || r.lon===null) return Infinity;return kmBetween(userPosition.lat,userPosition.lon,Number(r.lat),Number(r.lon));}
  function googleSectorLink(r){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([r.sector,r.comuna,'Chile'].filter(Boolean).join(', '));}

  function updateFilterOptions(){
    const comuna=$('comunaFilter'),type=$('typeFilter');
    const cOld=comuna.value,tOld=type.value;
    const comunas=[...new Set(db.places.map(r=>r.comuna).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const types=[...new Set(db.places.map(r=>r.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    comuna.innerHTML='<option value="">Todas las comunas</option>'+comunas.map(c=>`<option value="${html(c)}">${html(c)}</option>`).join('');
    type.innerHTML='<option value="">Todos los tipos</option>'+types.map(t=>`<option value="${html(t)}">${html(t)}</option>`).join('');
    comuna.value=comunas.includes(cOld)?cOld:'';type.value=types.includes(tOld)?tOld:'';
    $('placeCounter').textContent=db.places.length;
  }
  function filteredPlaces(){
    const q=normalize($('queryFilter').value.trim()), c=$('comunaFilter').value, t=$('typeFilter').value, budget=Number($('budgetFilter').value||Infinity);
    return db.places.filter(r => {
      const meal=cheapDish(r);
      if(!meal) return false;
      if(c && r.comuna!==c) return false;
      if(t && r.type!==t) return false;
      if(dishTotal(meal)>budget) return false;
      if(geoOnly && distanceFor(r)>8) return false;
      if(q && !normalize([r.name,r.comuna,r.sector,r.type,r.description,...r.menu.map(d=>d.name)].join(' ')).includes(q)) return false;
      return true;
    }).sort((a,b)=> geoOnly ? distanceFor(a)-distanceFor(b) : dishTotal(cheapDish(a))-dishTotal(cheapDish(b)));
  }
  function card(r,index){
    const meal=cheapDish(r),stat=statusOf(r),distance=geoOnly&&Number.isFinite(distanceFor(r))?` · ${distanceFor(r).toFixed(1)} km aprox.`:'';
    return `<article class="place-card"><div class="place-visual p${index%4}"><span class="food-emoji" aria-hidden="true">${html(r.emoji||'🍽️')}</span><span class="card-status ${stat.className}">${html(stat.text)}</span></div>
      <div class="place-body"><div class="place-meta"><span class="meta-type">${html(r.type||'Comida')}</span><span>${html(r.comuna)}</span></div><h3>${html(r.name)}</h3><p class="place-description">${html(r.description||'Explora la carta disponible de este local.')}</p><div class="place-location">⌾ <span>${html(r.sector||r.comuna)}${html(distance)}</span></div><div class="price-box"><div><small>Comidas desde</small><strong>${money(dishTotal(meal))}</strong></div><div class="price-suffix">Total sin propina<br>Impuestos incluidos*</div></div><div class="place-actions"><button type="button" class="btn btn-primary" data-show-place="${html(r.id)}">Ver carta y precio ↗</button><a class="btn btn-outline map-btn" target="_blank" rel="noopener noreferrer" title="Ver sector referencial en Google Maps" aria-label="Ver sector de ${html(r.name)} en Google Maps" href="${html(googleSectorLink(r))}">⌖</a></div></div></article>`;
  }
  function renderPlaces(){
    const matches=filteredPlaces();
    $('resultsGrid').innerHTML=matches.map(card).join('');
    $('resultsGrid').hidden=matches.length===0;
    $('emptyState').hidden=matches.length!==0;
    $('resultsCount').textContent=`${matches.length} ${matches.length===1?'local encontrado':'locales encontrados'}`;
    $('resultsTitle').textContent=geoOnly?'Opciones cercanas (aproximadas)':'Locales para explorar';
    return matches;
  }
  function clearFilters(){
    $('queryFilter').value='';$('comunaFilter').value='';$('typeFilter').value='';$('budgetFilter').value='';
    geoOnly=false;userPosition=null;$('geoStatus').textContent='La ubicación se usa solo en tu navegador. Los puntos del demo son aproximados.';
    renderPlaces();
  }
  function requestLocation(){
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation){reject(new Error('Este navegador no permite obtener ubicación.'));return;}
      navigator.geolocation.getCurrentPosition(pos=>resolve({lat:pos.coords.latitude,lon:pos.coords.longitude}),err=>reject(new Error(err.code===1?'Permiso de ubicación denegado. Puedes elegir una comuna.':'No se pudo obtener tu ubicación. Prueba con una comuna.')),{enableHighAccuracy:false,timeout:11000,maximumAge:60000});
    });
  }
  async function activateLocation(){
    $('geoStatus').textContent='Solicitando permiso de ubicación…';
    try{
      userPosition=await requestLocation();geoOnly=true;$('comunaFilter').value='';
      const matches=renderPlaces();
      $('geoStatus').textContent='Mostrando hasta 8 km de puntos de referencia ficticios. No son direcciones reales.';
      if(!matches.length)showToast('No hay puntos ficticios cerca. Puedes buscar por comuna.');
      return true;
    }catch(e){$('geoStatus').textContent=e.message;showToast(e.message,true);return false;}
  }

  function openDetail(id){
    const place=db.places.find(x=>x.id===id);if(!place)return;
    activePlaceId=id;selectedDishId=cheapDish(place)?.id || place.menu[0]?.id || null;
    renderDetail();$('detailOverlay').hidden=false;document.body.style.overflow='hidden';$('closeDetail').focus();
  }
  function renderDetail(){
    const r=db.places.find(x=>x.id===activePlaceId);if(!r)return;
    const dish=r.menu.find(d=>d.id===selectedDishId)||r.menu[0];
    const base=Number(dish?.price||0),fee=Number(dish?.mandatoryFee||0),sum=base+fee,tip=Math.round(sum*.1);
    const stat=statusOf(r);const url=isSafeURL(r.menuUrl);
    const menus=(r.menu||[]).map(d=>`<div class="menu-row ${d.available===false?'unavailable':''}"><div><strong>${html(d.name)}</strong><p>${html(d.detail||d.category||'')} ${d.available===false?'· NO DISPONIBLE':''}</p><small>${html(d.category||'Plato')}</small></div><div class="price-stack"><strong>${money(dishTotal(d))}</strong><small>precio final sin propina</small><button class="dish-select ${selectedDishId===d.id?'selected':''}" type="button" data-select-dish="${html(d.id)}" ${d.available===false?'disabled':''}>${selectedDishId===d.id?'✓ Seleccionado':'Ver desglose'}</button></div></div>`).join('');
    $('detailContent').innerHTML=`<div class="detail-hero"><span class="detail-emoji">${html(r.emoji||'🍽️')}</span><div><span class="card-status ${stat.className}" style="position:static;display:inline-block;margin-top:8px">${html(stat.text)}</span></div><h2 id="detailTitle">${html(r.name)}</h2><p>⌾ ${html(r.sector||'Sector referencial')}, ${html(r.comuna)}</p><p>${html(r.description||'')}</p></div>
      <div class="detail-body"><p class="detail-legend">Carta de demostración · Montos en pesos chilenos · Selecciona un producto para revisar su total. Los datos iniciales no han sido verificados con ningún comercio.</p><div class="menu-section-title">Carta disponible</div>${menus||'<p>No hay platos registrados.</p>'}
      ${dish?`<div class="pay-box"><h3>Tu precio claro: ${html(dish.name)}</h3><div class="pay-line"><span>Precio publicado (IVA incluido, si aplica)</span><strong>${money(base)}</strong></div><div class="pay-line"><span>Cargos obligatorios informados</span><strong>${money(fee)}</strong></div><div class="pay-line total"><span>Total a pagar sin propina</span><strong>${money(sum)}</strong></div><div class="pay-line"><span>Propina voluntaria ilustrativa (10%)</span><strong>+ ${money(tip)}</strong></div><div class="pay-line"><span>Si decides dejar esa propina</span><strong>${money(sum+tip)}</strong></div><p class="pay-note">La propina es voluntaria y no está incluida en el total obligatorio. Este cálculo aplica a una unidad del producto seleccionado.</p></div>`:''}
      <div class="detail-foot"><p><strong>Estado:</strong> ${html(stat.text)}. ${r.status==='demo'?'Esta adhesión y sello son solo ilustrativos.':'La fecha/estado son datos ingresados por el editor, no una auditoría independiente.'}</p><p><strong>Última verificación registrada:</strong> ${html(niceDate(r.verifiedAt))}.</p><p><strong>Respaldo de precio:</strong> ${html(r.evidence||'No registrado (dato ficticio)')}.</p>${r.notes?`<p><strong>Observaciones:</strong> ${html(r.notes)}</p>`:''}${url?`<p><a href="${html(url)}" target="_blank" rel="noopener noreferrer">Abrir carta del local ↗</a></p>`:''}<p><strong>Ubicación:</strong> referencial. No hay dirección física verificada para los locales ficticios.</p></div>
      <div class="detail-actions"><a class="btn btn-outline" href="${html(googleSectorLink(r))}" target="_blank" rel="noopener noreferrer">Ver zona en mapa ↗</a><button type="button" id="detailDismiss" class="btn btn-primary">Seguir explorando</button></div></div>`;
  }
  function closeDetail(){ $('detailOverlay').hidden=true;activePlaceId=null;document.body.style.overflow=$('adminOverlay').hidden?'':'hidden'; }

  function chatAdd(role,text){messages.push({role,text});renderChat();}
  function renderChat(){
    const box=$('chatMessages'); box.replaceChildren();
    for (const m of messages){ const row=document.createElement('div');row.className='chat-row '+(m.role==='user'?'user':'bot');if(m.role==='bot'){const av=document.createElement('span');av.className='chat-bot-avatar';av.textContent='✦';row.append(av);}const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=m.text;row.append(bubble);box.append(row); }
    box.scrollTop=box.scrollHeight;
    let options=[];
    if(chatPhase==='budget') options=[{label:'Hasta $3.000',value:'3000'},{label:'Hasta $5.000',value:'5000'},{label:'Hasta $7.000',value:'7000'},{label:'Sin límite',value:''}];
    if(chatPhase==='comuna') options=[{label:'◎ Cerca de mí',value:'__geo'},{label:'Cualquier comuna',value:''},...[...new Set(db.places.map(p=>p.comuna))].sort((a,b)=>a.localeCompare(b,'es')).map(x=>({label:x,value:x}))];
    if(chatPhase==='type') options=[{label:'Cualquier tipo',value:''},...[...new Set(db.places.map(p=>p.type))].sort((a,b)=>a.localeCompare(b,'es')).map(x=>({label:x,value:x}))];
    if(chatPhase==='done') options=[{label:'↗ Ver resultados',value:'__results'},{label:'↻ Nueva búsqueda',value:'__restart'}];
    $('chatChoices').innerHTML=options.map((x,i)=>`<button class="choice ${chatPhase==='done'&&i===0?'choice-primary':''}" type="button" data-chat-choice="${html(x.value)}">${html(x.label)}</button>`).join('');
  }
  function resetChat(){chatPhase='budget';messages=[];chatAdd('bot','¡Hola! 👋 Soy tu asistente Precios Claro.\n¿Con cuánto presupuesto cuentas para comer?');}
  async function chatChoose(value,label){
    if(chatPhase==='done'){if(value==='__results')scrollExplore();else resetChat();return;}
    if(chatPhase==='budget'){
      $('budgetFilter').value=value;chatAdd('user',label);chatPhase='comuna';chatAdd('bot','¡Perfecto! ¿En qué comuna te gustaría buscar? También puedes compartir tu ubicación.');return;
    }
    if(chatPhase==='comuna'){
      chatAdd('user',label);
      if(value==='__geo'){const success=await activateLocation();if(!success){chatAdd('bot','No pude consultar tu ubicación. Elige una comuna para continuar.');return;}}
      else {geoOnly=false;userPosition=null;$('comunaFilter').value=value;}
      chatPhase='type';chatAdd('bot','Una última cosa: ¿qué tipo de comida prefieres?');return;
    }
    if(chatPhase==='type'){
      $('typeFilter').value=value;chatAdd('user',label);chatPhase='done';const found=renderPlaces();
      chatAdd('bot',found.length?`¡Listo! Encontré ${found.length} ${found.length===1?'local':'locales'} con opciones dentro de tus filtros.\nPuedes abrir cada carta y revisar el total sin propina.`:'No encontré locales con esos filtros. Puedes probar con otra comuna o un presupuesto mayor.');
    }
  }

  // -------- Panel de edición local --------
  function openAdmin(){
    $('adminOverlay').hidden=false;document.body.style.overflow='hidden';
    refreshCloudUi();
    if (!cloudConfigured || cloudIsAdmin) {
      if(!editing){selectEditorPlace(db.places[0]?.id || null);}
      else{renderAdminList();renderEditor();}
    }
    $('closeAdmin').focus();
  }
  function closeAdmin(){ $('adminOverlay').hidden=true;document.body.style.overflow=$('detailOverlay').hidden?'':'hidden'; }
  function alertAdmin(msg,success=false){ const el=$('adminNotice');el.textContent=msg;el.classList.toggle('success',success); }
  function newPlace(){return {id:newId(),name:'',comuna:'Santiago Centro',sector:'',type:'Almuerzos',emoji:'🍽️',description:'',lat:null,lon:null,status:'demo',verifiedAt:'',evidence:'',menuUrl:'',notes:'',menu:[newDish()]};}
  function newDish(){return {id:newId(),name:'',detail:'',category:'Plato',price:0,mandatoryFee:0,available:true};}
  function selectEditorPlace(id){
    editingRevision=cloudRevision;
    activeEditId=id;
    editing=id?clone(db.places.find(r=>r.id===id)||newPlace()):newPlace();
    renderAdminList();renderEditor();
  }
  function renderAdminList(){
    $('adminPlaceList').innerHTML=db.places.map(r=>`<button type="button" class="admin-list-item ${r.id===activeEditId?'active':''}" data-edit-place="${html(r.id)}"><span class="item-icon">${html(r.emoji||'🍽️')}</span><span><span class="item-name">${html(r.name)}</span><span class="item-sub">${html(r.comuna)}</span></span></button>`).join('');
  }
  function option(current,val,label){return `<option value="${html(val)}" ${current===val?'selected':''}>${html(label||val)}</option>`;}
  function inputField(name,label,full=false,type='text',hint='',required=false){
    const val=editing[name]===null?'':editing[name]??'';
    return `<div class="form-field ${full?'full':''}"><label for="f-${name}">${html(label)}${required?' *':''}</label><input id="f-${name}" name="${name}" type="${type}" value="${html(val)}" ${hint?`placeholder="${html(hint)}"`:''} ${required?'required':''} ${type==='number'?'step="any"':''}></div>`;
  }
  function dishForm(d,index){return `<div class="dish-edit-row" data-dish-id="${html(d.id)}"><div class="dish-edit-title"><strong>Producto ${index+1}</strong><button type="button" data-delete-dish="${html(d.id)}">Eliminar producto ✕</button></div><div class="form-grid">
      <div class="form-field"><label>Nombre del producto *</label><input data-dish="name" value="${html(d.name)}" placeholder="Ej. Menú del día" required></div>
      <div class="form-field"><label>Categoría</label><select data-dish="category">${['Menú','Plato','Bebida','Postre'].map(x=>option(d.category,x)).join('')}</select></div>
      <div class="form-field full"><label>Descripción</label><input data-dish="detail" value="${html(d.detail)}" placeholder="Qué incluye o qué condiciones tiene"></div>
      <div class="form-field"><label>Precio con impuestos (CLP) *</label><input type="number" min="0" step="1" data-dish="price" value="${html(d.price)}" required></div>
      <div class="form-field"><label>Cargos obligatorios (CLP)</label><input type="number" min="0" step="1" data-dish="mandatoryFee" value="${html(d.mandatoryFee||0)}"></div>
      </div><label class="dish-available"><input type="checkbox" data-dish="available" ${d.available!==false?'checked':''}> Producto disponible</label></div>`;}
  function renderEditor(){
    if(!editing){$('editorContent').innerHTML='<div class="admin-empty">Elige o crea un restaurante para editarlo.</div>';return;}
    const r=editing;
    $('editorContent').innerHTML=`<form id="restaurantForm" class="admin-form"><h3>${activeEditId?'Editar restaurante':'Agregar restaurante nuevo'}</h3><div class="form-grid">
      ${inputField('name','Nombre del restaurante',false,'text','Ej. La Olla del Campus',true)}
      ${inputField('emoji','Emoji identificador',false,'text','🍽️')}
      ${inputField('comuna','Comuna',false,'text','Ej. Ñuñoa',true)}
      ${inputField('sector','Sector de referencia',false,'text','Ej. Plaza Ñuñoa')}
      <div class="form-field"><label for="f-type">Tipo de comida</label><select id="f-type" name="type">${['Almuerzos','Colaciones','Vegetariano','Sándwiches','Desayunos','Otro'].map(x=>option(r.type,x)).join('')}${!['Almuerzos','Colaciones','Vegetariano','Sándwiches','Desayunos','Otro'].includes(r.type)?option(r.type,r.type):''}</select></div>
      <div class="form-field"><label for="f-status">Estado del sello</label><select id="f-status" name="status">${option(r.status,'demo','Demo — sello ficticio')}${option(r.status,'pendiente','Pendiente de verificación')}${option(r.status,'verificado','Revisado — requiere respaldo')}</select></div>
      <div class="form-field full"><label for="f-description">Descripción breve</label><textarea id="f-description" name="description" placeholder="Qué ofrece este lugar">${html(r.description||'')}</textarea></div>
      ${inputField('lat','Latitud (opcional)',false,'number','-33.4489')}
      ${inputField('lon','Longitud (opcional)',false,'number','-70.6693')}
      ${inputField('verifiedAt','Fecha de verificación',false,'date')}
      ${inputField('evidence','Fuente o respaldo',false,'text','Ej. Carta revisada el día…')}
      ${inputField('menuUrl','URL de la carta (https://)',true,'url','https://ejemplo.cl/carta')}
      <div class="form-field full"><label for="f-notes">Condiciones y observaciones</label><textarea id="f-notes" name="notes" placeholder="Horario, restricciones, condiciones de las promociones…">${html(r.notes||'')}</textarea></div></div>
      <p class="form-note">Para indicar “Revisado” se requiere fuente y fecha de revisión. El estado lo declara el editor; no es una certificación externa. Una revisión deja de mostrarse como vigente pasados 30 días.</p>
      <div class="admin-section"><h4>Carta y precios (${r.menu.length})</h4><div id="menuEditorList" class="menu-editor-list">${r.menu.map(dishForm).join('')}</div><button id="addDish" type="button" class="btn btn-outline" style="margin-top:12px">+ Agregar producto</button><p class="form-note">Registra cada producto con impuestos incluidos y suma cualquier cargo obligatorio. La propina voluntaria se calcula por separado.</p></div>
      <div class="admin-form-actions">${activeEditId?'<button type="button" class="btn btn-text danger-button" id="deletePlace">Eliminar local</button>':''}<button type="button" class="btn btn-outline" id="reloadCurrent">↻ Recargar versión actual</button><button class="btn btn-primary" type="submit">✓ Guardar cambios</button></div></form>`;
  }
  function readEditor(){
    const f=$('restaurantForm');if(!f)return null;
    if(!f.reportValidity())return null;
    const obj=clone(editing);
    const data=new FormData(f);
    for(const field of ['name','emoji','comuna','sector','type','status','description','verifiedAt','evidence','menuUrl','notes']) obj[field]=String(data.get(field)||'').trim();
    const lat=String(data.get('lat')||'').trim(),lon=String(data.get('lon')||'').trim();
    obj.lat=lat===''?null:Number(lat);obj.lon=lon===''?null:Number(lon);
    if(obj.lat!==null && (!Number.isFinite(obj.lat)||obj.lat< -90||obj.lat>90)){alertAdmin('Revisa la latitud: debe estar entre -90 y 90.');return null;}
    if(obj.lon!==null && (!Number.isFinite(obj.lon)||obj.lon< -180||obj.lon>180)){alertAdmin('Revisa la longitud: debe estar entre -180 y 180.');return null;}
    if(obj.menuUrl&&!isSafeURL(obj.menuUrl)){alertAdmin('La URL de la carta debe comenzar con https:// o http://.');return null;}
    if(obj.status==='verificado'&&(!obj.verifiedAt||!obj.evidence)){alertAdmin('Para marcar un local como revisado, ingresa fecha y fuente de verificación.');return null;}
    const rows=[...f.querySelectorAll('.dish-edit-row')];
    obj.menu=rows.map(row=>{
      const pick=n=>row.querySelector(`[data-dish="${n}"]`);
      return {id:row.dataset.dishId,name:pick('name').value.trim(),detail:pick('detail').value.trim(),category:pick('category').value,price:Number(pick('price').value),mandatoryFee:Number(pick('mandatoryFee').value||0),available:pick('available').checked};
    });
    if(obj.menu.length===0 || obj.menu.some(d=>!d.name||!Number.isSafeInteger(d.price)||d.price<0||!Number.isSafeInteger(d.mandatoryFee)||d.mandatoryFee<0)){alertAdmin('Agrega al menos un producto y revisa que sus precios y cargos sean enteros no negativos.');return null;}
    if(!obj.name||!obj.comuna){alertAdmin('Debes indicar el nombre y la comuna.');return null;}
    return obj;
  }
  async function saveEditor(event){
    event.preventDefault();const result=readEditor();if(!result)return;
    const next=clone(db);
    const i=next.places.findIndex(p=>p.id===result.id);
    if(i===-1)next.places.push(result);else next.places[i]=result;
    if(cloudConfigured){
      const saved=await publishOnline(next,editingRevision);
      if(!saved)return;
      db=clone(saved);cloudRevision=saved.revision;cloudHasCatalog=true;
    }else{db=next;persist();}
    activeEditId=result.id;editing=clone(result);editingRevision=cloudRevision;
    updateFilterOptions();renderPlaces();renderAdminList();renderEditor();refreshCloudUi();
    alertAdmin(cloudConfigured?'✓ Publicado en Firebase. Los visitantes verán la actualización automáticamente.':'✓ Guardado en este navegador. Para publicarlo, descarga datos.js.',true);
    showToast(cloudConfigured?'Publicado para todos correctamente.':'Borrador guardado correctamente.');
  }
  async function deleteEditor(){
    if(!activeEditId)return;
    if(!window.confirm(`¿Eliminar “${editing.name}” ${cloudConfigured?'de la base online para todos':'del borrador local'}?`))return;
    const next=clone(db);next.places=next.places.filter(x=>x.id!==activeEditId);
    if(cloudConfigured){
      const saved=await publishOnline(next,editingRevision);
      if(!saved)return;
      db=clone(saved);cloudRevision=saved.revision;cloudHasCatalog=true;
    }else{db=next;persist();}
    selectEditorPlace(db.places[0]?.id||null);updateFilterOptions();renderPlaces();refreshCloudUi();
    alertAdmin(cloudConfigured?'✓ Local eliminado de Firebase para todos.':'Local eliminado del borrador. Exporta datos.js para publicar el cambio.',true);
  }
  function deleteDish(id){
    const rows=[...$('menuEditorList').querySelectorAll('.dish-edit-row')];
    if(rows.length===1){showToast('Registra al menos un producto por local.',true);return;}
    const row=$('menuEditorList').querySelector(`[data-dish-id="${CSS.escape(id)}"]`);
    if(row)row.remove();
  }
  function appendDish(){
    const list=$('menuEditorList');const d=newDish();
    list.insertAdjacentHTML('beforeend',dishForm(d,list.querySelectorAll('.dish-edit-row').length));
    list.lastElementChild.querySelector('[data-dish="name"]').focus();
  }
  function downloadFile(filename,content,type){
    const blob=new Blob([content],{type}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);
  }
  function publishExport(){
    const content='/* Archivo exportado desde Precios Claro. No incluyas contraseñas aquí. */\nwindow.PRECIOS_CLARO_DATA = '+JSON.stringify(db,null,2).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n';
    downloadFile('datos.js',content,'application/javascript;charset=utf-8');
    alertAdmin('✓ Descargaste datos.js. En GitHub, reemplaza el archivo del mismo nombre y confirma el cambio. Solo entonces otros verán los datos nuevos.',true);
  }
  function jsonExport(){ downloadFile('precios-claro-respaldo.json',JSON.stringify(db,null,2),'application/json;charset=utf-8');showToast('Respaldo JSON descargado.'); }
  async function jsonImport(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>2000000){alertAdmin('El archivo supera el límite de 2 MB.');return;}
    try{
      const parsed=JSON.parse(await file.text());if(!validData(parsed))throw new Error('Formato no compatible.');
      if(!window.confirm(`¿Cargar ${parsed.places.length} locales del archivo? ${cloudConfigured?'Reemplazará el catálogo online PARA TODOS.':'Reemplazará tu borrador local.'}`))return;
      if(cloudConfigured){
        const saved=await publishOnline(parsed,cloudRevision);
        if(!saved)return;
        db=clone(saved);cloudRevision=saved.revision;cloudHasCatalog=true;
      }else{db=clone(parsed);persist();}
      selectEditorPlace(db.places[0]?.id||null);updateFilterOptions();renderPlaces();resetChat();refreshCloudUi();
      alertAdmin(cloudConfigured?'✓ JSON publicado directamente en Firebase.':'✓ Respaldo importado como borrador local.',true);
    }catch(e){alertAdmin('No se pudo importar el JSON: '+e.message);}
  }
  function restorePublished(){
    if(cloudConfigured){alertAdmin('En modo nube, el catálogo siempre se sincroniza automáticamente.');return;}
    if(!window.confirm('¿Descartar el borrador local y volver a los datos publicados en datos.js?'))return;
    db=clone(published);try{localStorage.removeItem(KEY);}catch{};updatePreviewLabel();selectEditorPlace(db.places[0]?.id||null);updateFilterOptions();clearFilters();resetChat();alertAdmin('✓ Borrador descartado. Ahora se muestran los datos que contiene datos.js.',true);
  }

  // -------- Sincronización online opcional --------
  function setSyncStatus(message, state=''){
    const el=$('syncStatus');el.textContent=message;el.dataset.state=state;
  }
  function refreshCloudUi(){
    $('adminGate').hidden=!cloudConfigured || cloudIsAdmin;
    $('adminContent').hidden=cloudConfigured && !cloudIsAdmin;
    $('exportJs').hidden=cloudConfigured;
    $('restoreDemo').hidden=cloudConfigured;
    $('seedCloud').hidden=!cloudConfigured || !cloudIsAdmin || !cloudReady || cloudHasCatalog;
    $('editorSession').hidden=!cloudConfigured || !cloudIsAdmin;
    $('editorIdentity').textContent=cloudEmail ? `Editor: ${cloudEmail}` : 'Editor autorizado';
    $('adminInstructions').textContent=cloudConfigured
      ? 'Al guardar, los cambios se publican en Firebase y aparecen para todos los visitantes. Solo ingresan editores autorizados.'
      : 'Modo local de ejemplo. Para publicar automáticamente, sigue la guía de conexión a Firebase.';
    const info=$('adminGateMessage');
    if(!cloudApi){
      info.textContent='Conectando al sistema de acceso seguro…';
    }else if(cloudEmail && !cloudIsAdmin){
      info.textContent=`La cuenta ${cloudEmail} inició sesión, pero no está autorizada para editar. Comprueba que en Firebase exista admins/{UID} con active = true.`;
    }else{
      info.textContent='Ingresa con un usuario creado por tu equipo en Firebase Authentication. No está habilitado el registro público.';
    }
    $('adminLoginForm').hidden=cloudEmail && !cloudIsAdmin;
    $('unauthorizedLogout').hidden=!cloudEmail || cloudIsAdmin;
    $('adminLoginButton').disabled=cloudLoginPending || !cloudApi;
    if(cloudConfigured && cloudIsAdmin && !cloudHasCatalog){
      alertAdmin('El catálogo online todavía está vacío. Pulsa “Publicar locales de ejemplo” para cargar los ocho restaurantes ficticios.');
    }
    updatePreviewLabel();
  }
  function refreshViewsFromCloud(data){
    if(data && validData(data)){
      db=clone(data);
      cloudHasCatalog=true;cloudRevision=Number(data.revision || 0);
      setSyncStatus('● Catálogo online actualizado','online');
    }else if(data===null){
      db=clone(published);cloudHasCatalog=false;cloudRevision=0;
      setSyncStatus('● Demo aún no publicada','waiting');
    }else{
      setSyncStatus('⚠ Datos online incompatibles','error');
      showToast('El catálogo en Firebase no tiene un formato compatible.',true);return;
    }
    cloudReady=true;
    updateFilterOptions();renderPlaces();resetChat();refreshCloudUi();
    // No sobrescribimos un formulario abierto para no perder cambios sin guardar.
    if(cloudIsAdmin && !editing){selectEditorPlace(db.places[0]?.id || null);}
    else if(cloudIsAdmin){renderAdminList();}
    if(activePlaceId){
      if(db.places.some(r=>r.id===activePlaceId))renderDetail();else closeDetail();
    }
  }
  async function publishOnline(next,expectedRevision){
    if(!cloudConfigured || !cloudApi || !cloudReady || !cloudIsAdmin){
      alertAdmin('No hay conexión con Firebase o no tienes permiso de editor. No se publicó ningún cambio.');return null;
    }
    try{
      alertAdmin('Guardando en Firebase…');
      const result=await cloudApi.publish(next,expectedRevision);
      return result;
    }catch(e){
      alertAdmin('No se pudo publicar: '+e.message);
      showToast('No se guardó en Firebase.',true);
      return null;
    }
  }
  function onCloudReady(){
    cloudApi=window.PC_CLOUD;
    if(!cloudApi)return;
    setSyncStatus('● Sincronizando…','waiting');refreshCloudUi();
    cloudApi.start({
      onCatalog: refreshViewsFromCloud,
      onCatalogError(error){
        cloudReady=false;setSyncStatus('⚠ Sin conexión a Firebase','error');
        alertAdmin('No se pudo leer Firebase: '+(error?.message||error));
        showToast('No se pudo sincronizar con Firebase. Se ven datos de ejemplo, no confirmados.',true);
      },
      onAuth({email,permitted,error}){
        cloudEmail=email;cloudIsAdmin=Boolean(permitted);
        if(error)alertAdmin('Error al comprobar permisos de editor: '+error);
        if(!cloudIsAdmin)editing=null;
        refreshCloudUi();
        if(cloudIsAdmin && !$('adminOverlay').hidden && !editing){selectEditorPlace(db.places[0]?.id||null);}
      }
    });
  }
  if (cloudConfigured){
    setSyncStatus('● Conectando Firebase…','waiting');
    window.addEventListener('precios-claro-cloud-ready',onCloudReady,{once:true});
    window.addEventListener('precios-claro-cloud-error',e=>{
      cloudReady=false;setSyncStatus('⚠ No se cargó Firebase','error');
      alertAdmin('Error al iniciar Firebase: '+e.detail);
    },{once:true});
    if(window.PC_CLOUD)onCloudReady();
  }else{
    setSyncStatus('● Modo local','waiting');
  }
  $('adminLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!cloudApi)return;
    cloudLoginPending=true;refreshCloudUi();
    try{
      await cloudApi.signIn($('adminEmail').value.trim(),$('adminPassword').value);
      $('adminPassword').value='';
    }catch(error){
      $('adminGateMessage').textContent=error.message;
      showToast(error.message,true);
    }finally{cloudLoginPending=false;refreshCloudUi();}
  });
  $('signOut').addEventListener('click',async()=>{
    try{await cloudApi?.signOut();editing=null;}catch(e){showToast(e.message,true);}
  });
  $('unauthorizedLogout').addEventListener('click',async()=>{
    try{await cloudApi?.signOut();}catch(e){showToast(e.message,true);}
  });
  $('seedCloud').addEventListener('click',async()=>{
    if(cloudHasCatalog || !cloudReady || !cloudIsAdmin)return;
    if(!window.confirm('¿Publicar los 8 restaurantes ficticios de ejemplo para todos los visitantes?'))return;
    const next=clone(published);
    const saved=await publishOnline(next,0);
    if(!saved)return;
    db=clone(saved);cloudHasCatalog=true;cloudRevision=saved.revision;
    selectEditorPlace(db.places[0]?.id||null);updateFilterOptions();renderPlaces();refreshCloudUi();
    alertAdmin('✓ Los datos de ejemplo están ahora compartidos en Firebase. Prueba editando un precio.',true);
  });

  // Eventos
  for (const id of ['queryFilter','budgetFilter','comunaFilter','typeFilter']) $(id).addEventListener(id==='queryFilter'?'input':'change',()=>{if(id==='comunaFilter'){geoOnly=false;userPosition=null;}renderPlaces();});
  $('clearFilters').addEventListener('click',clearFilters);
  $('emptyClear').addEventListener('click',clearFilters);
  $('geolocate').addEventListener('click',activateLocation);
  $('resultsGrid').addEventListener('click',e=>{const el=e.target.closest('[data-show-place]');if(el)openDetail(el.dataset.showPlace);});
  $('closeDetail').addEventListener('click',closeDetail);
  $('detailContent').addEventListener('click',e=>{
    const dish=e.target.closest('[data-select-dish]');if(dish){selectedDishId=dish.dataset.selectDish;renderDetail();return;}
    if(e.target.closest('#detailDismiss'))closeDetail();
  });
  $('chatReset').addEventListener('click',resetChat);
  $('chatChoices').addEventListener('click',e=>{const choice=e.target.closest('[data-chat-choice]');if(choice)chatChoose(choice.dataset.chatChoice,choice.textContent);});
  $('openAdmin').addEventListener('click',openAdmin);
  $('footerAdmin').addEventListener('click',openAdmin);
  $('closeAdmin').addEventListener('click',closeAdmin);
  document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>x.dataset.close==='admin'?closeAdmin():closeDetail()));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('adminOverlay').hidden)closeAdmin();else if(!$('detailOverlay').hidden)closeDetail();}});
  $('adminPlaceList').addEventListener('click',e=>{const b=e.target.closest('[data-edit-place]');if(b)selectEditorPlace(b.dataset.editPlace);});
  $('addPlace').addEventListener('click',()=>selectEditorPlace(null));
  $('editorContent').addEventListener('submit',e=>{if(e.target.id==='restaurantForm')saveEditor(e);});
  $('editorContent').addEventListener('click',e=>{
    if(e.target.closest('#addDish')){appendDish();return;}
    const del=e.target.closest('[data-delete-dish]');if(del){deleteDish(del.dataset.deleteDish);return;}
    if(e.target.closest('#deletePlace')){deleteEditor();return;}
    if(e.target.closest('#reloadCurrent')){
      if(window.confirm('¿Descartar los cambios no guardados del formulario y cargar la versión actual?')){
        selectEditorPlace(activeEditId);alertAdmin('Formulario recargado con la última versión disponible.',true);
      }
    }
  });
  $('exportJs').addEventListener('click',publishExport);
  $('exportJson').addEventListener('click',jsonExport);
  $('importJson').addEventListener('change',jsonImport);
  $('restoreDemo').addEventListener('click',restorePublished);
  updatePreviewLabel();updateFilterOptions();renderPlaces();resetChat();
})();