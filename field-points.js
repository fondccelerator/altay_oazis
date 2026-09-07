/* ============ ПОЛЕВЫЕ ЗАМЕТКИ ============
   Точки, которые ставятся прямо с телефона.
   Хранятся в Google Таблице, адрес задан в config.js.
   Нет сети — запись ложится в память телефона и уходит сама, когда связь появится.
   Каждое изменение пишется в лист «журнал» той же таблицы.
   ========================================= */

const FIELD_COLORS = {
  'земля':'#C9A227','объект':'#1B3A2F','застройщик':'#2E5545',
  'риск':'#9E2B25','заметка':'#6B8578'
};
const QUEUE_KEY = 'altay_field_queue';
const gField = L.layerGroup();
const FIELD_INDEX = {};

let pickMode = false, pickedLatLng = null, pickMarker = null, editId = null;
let watchId = null, meMarker = null, meCircle = null, lastPos = null;

/* ---------- стили кнопок в карточке ---------- */
(function(){
  const st = document.createElement('style');
  st.textContent =
    '.fpAct{display:flex;gap:6px;margin-top:10px;padding-top:9px;border-top:1px solid #DCE5DF}'+
    '.fpAct button{flex:1;border:1px solid #DCE5DF;background:#fff;color:#1B3A2F;border-radius:7px;'+
    'padding:7px 6px;font:600 12px/1 Arial;cursor:pointer}'+
    '.fpAct button:hover{background:#EEF3F0}'+
    '.fpAct .del{color:#9E2B25;border-color:#F0D8D6}'+
    '.fpGrip{display:flex;align-items:center;justify-content:center;gap:9px;'+
    'margin:-8px -18px 10px;padding:9px;cursor:pointer;user-select:none;'+
    'border-bottom:1px solid #EEF3F0}'+
    '.fpGrip i{display:block;width:40px;height:4px;border-radius:3px;background:#DCE5DF}'+
    '.fpGrip b{font:600 11px/1 Arial;color:#6B8578}'+
    '#fpSheet.fpMin{max-height:none}'+
    '#fpSheet.fpMin label,#fpSheet.fpMin input[type=text],#fpSheet.fpMin textarea,'+
    '#fpSheet.fpMin .fpChips,#fpSheet.fpMin .fpPlace,#fpSheet.fpMin #fpGeoState,'+
    '#fpSheet.fpMin .sub{display:none}'+
    '#fpSheet.fpMin #fpCoords{margin-top:0}';
  document.head.appendChild(st);
})();

/* ---------- сворачивание панели ---------- */
const MIN_KEY = 'altay_sheet_min';

function buildGrip(){
  const sheet = document.getElementById('fpSheet');
  if(!sheet || sheet.querySelector('.fpGrip')) return;
  const g = document.createElement('div');
  g.className = 'fpGrip';
  g.innerHTML = '<i></i><b></b>';
  g.addEventListener('click', toggleMin);
  sheet.insertBefore(g, sheet.firstChild);
  if(localStorage.getItem(MIN_KEY) === '1') sheet.classList.add('fpMin');
  paintGrip();
}

function paintGrip(){
  const sheet = document.getElementById('fpSheet');
  const b = sheet && sheet.querySelector('.fpGrip b');
  if(!b) return;
  b.textContent = sheet.classList.contains('fpMin') ? 'развернуть' : 'свернуть';
}

function toggleMin(){
  const sheet = document.getElementById('fpSheet');
  sheet.classList.toggle('fpMin');
  try{ localStorage.setItem(MIN_KEY, sheet.classList.contains('fpMin') ? '1' : '0'); }catch(e){}
  paintGrip();
}

/* ---------- вид на телефоне ---------- */
(function(){
  const st = document.createElement('style');
  st.textContent =
  '@media(max-width:820px){' +
    '#app{height:100dvh}' +
    '#side{position:fixed;top:0;left:0;right:0;z-index:9000;max-height:82dvh;' +
      'transform:translateY(-102%);transition:transform .22s ease;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.28);border-bottom:1px solid #DCE5DF}' +
    '#side.fpOpen{transform:translateY(0)}' +
    '#side.fpOpen #head{padding-top:54px}' +
    '#map{flex:1;height:100dvh}' +
    '.lyr{font-size:14px;padding:9px 8px;gap:11px}' +
    '.lyr input{width:19px;height:19px;margin-top:1px}' +
    '.grp h2{font-size:12px}' +
    '#head h1{font-size:17px}' +
    '#head p{font-size:12px}' +
    '.leaflet-top.leaflet-left{top:56px}' +
    '.leaflet-popup-content{font-size:13.5px;line-height:1.5}' +
    '.leaflet-popup-content-wrapper{border-radius:12px}' +
    '.lg{display:none}' +
    '.lg.fpOpen{display:block;right:10px;bottom:64px;max-width:70vw;font-size:12px}' +
    '#fpSheet{max-height:84dvh;padding-bottom:34px}' +
    '#fpSheet input[type=text],#fpSheet textarea{font-size:16px}' +
    '.fpChips span{padding:11px 15px;font-size:14px}' +
    '.fpPlace button{padding:14px 8px;font-size:14px}' +
    '#fpSave,#fpClose{padding:16px;font-size:15px}' +
  '}' +
  '.fpTopBtn{position:fixed;z-index:9500;border:none;border-radius:22px;' +
    'font:700 13px/1 Arial;box-shadow:0 2px 10px rgba(0,0,0,.28);cursor:pointer;padding:11px 15px}' +
  '#fpLayersBtn{left:12px;top:12px;background:#fff;color:#1B3A2F;border:1px solid #DCE5DF}' +
  '#fpLegendBtn{right:12px;bottom:12px;background:#fff;color:#6B8578;border:1px solid #DCE5DF;' +
    'border-radius:50%;width:40px;height:40px;padding:0;font-size:16px}' +
  '@media(min-width:821px){.fpTopBtn{display:none}}' +
  '#fpGeoBtn{right:12px;bottom:62px;background:#fff;color:#1B3A2F;border:1px solid #DCE5DF;' +
    'border-radius:50%;width:40px;height:40px;padding:0;font-size:17px;line-height:1}' +
  '#fpGeoBtn.on{background:#1B3A2F;color:#fff;border-color:#1B3A2F}' +
  '.meDot{width:16px;height:16px;border-radius:50%;background:#1E6FD9;border:3px solid #fff;' +
    'box-shadow:0 0 0 2px rgba(30,111,217,.35),0 1px 5px rgba(0,0,0,.4)}' +
  '@media(max-width:980px) and (orientation:landscape){' +
    '#fpSheet{left:auto;right:0;top:0;bottom:0;width:54vw;max-width:430px;max-height:100dvh;' +
      'border-radius:14px 0 0 14px;padding:14px 16px 18px;overflow-y:auto}' +
    '#fpSheet.fpMin{top:auto;bottom:0;height:auto}' +
    '.fpGrip{margin:-6px -16px 8px}' +
    '#side{width:62vw;max-width:440px;right:auto;max-height:100dvh;' +
      'transform:translateX(-102%);transition:transform .22s ease}' +
    '#side.fpOpen{transform:translateX(0)}' +
    '#side.fpOpen #head{padding-top:15px}' +
    '#fpAdd{padding:9px 13px;font-size:13px}' +
    '#fpSheet label{margin:9px 0 4px}' +
    '#fpSheet textarea{min-height:56px}' +
    '.fpBtns{margin-top:12px}' +
    '#fpSave,#fpClose{padding:12px;font-size:14px}' +
    '#fpHint{top:auto;bottom:12px}' +
  '}';
  document.head.appendChild(st);
})();

function buildMobileUI(){
  if(document.getElementById('fpLayersBtn')) return;
  const side = document.getElementById('side');
  const lg   = document.querySelector('.lg');

  const b = document.createElement('button');
  b.id = 'fpLayersBtn'; b.className = 'fpTopBtn'; b.textContent = 'Слои';
  b.addEventListener('click', () => {
    if(!side) return;
    side.classList.toggle('fpOpen');
    b.textContent = side.classList.contains('fpOpen') ? 'Закрыть' : 'Слои';
  });
  document.body.appendChild(b);

  if(lg){
    const l = document.createElement('button');
    l.id = 'fpLegendBtn'; l.className = 'fpTopBtn'; l.textContent = 'i';
    l.title = 'Легенда';
    l.addEventListener('click', () => lg.classList.toggle('fpOpen'));
    document.body.appendChild(l);
  }

  const geo = document.createElement('button');
  geo.id = 'fpGeoBtn'; geo.className = 'fpTopBtn'; geo.textContent = '◎';
  geo.title = 'Показывать, где я';
  geo.addEventListener('click', toggleWatch);
  document.body.appendChild(geo);

  // тап по карте закрывает шторку со слоями
  map.on('click', () => {
    if(side && side.classList.contains('fpOpen')){
      side.classList.remove('fpOpen');
      b.textContent = 'Слои';
    }
  });
}

/* ---------- слежение за своим положением ---------- */
function drawMe(pos){
  lastPos = pos;
  const ll = [pos.coords.latitude, pos.coords.longitude];
  const acc = pos.coords.accuracy || 0;

  if(!meMarker){
    meMarker = L.marker(ll, {zIndexOffset:1000, icon:L.divIcon({className:'', iconSize:[16,16],
      iconAnchor:[8,8], html:'<div class="meDot"></div>'})}).addTo(map);
    meCircle = L.circle(ll, {radius:acc, color:'#1E6FD9', weight:1, fillColor:'#1E6FD9',
      fillOpacity:.10}).addTo(map);
  } else {
    meMarker.setLatLng(ll);
    meCircle.setLatLng(ll).setRadius(acc);
  }
  meMarker.bindPopup('Вы здесь<br>Точность около ' + Math.round(acc) + ' м' +
    '<div class="fpAct"><button onclick="addHere()">Поставить точку здесь</button></div>');
}

function toggleWatch(){
  const btn = document.getElementById('fpGeoBtn');
  if(watchId !== null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    if(meMarker){ map.removeLayer(meMarker); meMarker = null; }
    if(meCircle){ map.removeLayer(meCircle); meCircle = null; }
    btn.classList.remove('on');
    return;
  }
  if(!navigator.geolocation){ alert('Телефон не отдаёт координаты'); return; }
  btn.classList.add('on');
  let first = true;
  watchId = navigator.geolocation.watchPosition(
    pos => { drawMe(pos); if(first){ map.setView([pos.coords.latitude,pos.coords.longitude], 14); first = false; } },
    err => { btn.classList.remove('on'); watchId = null;
             alert('Не получилось определить место. Проверьте, разрешён ли доступ к геолокации.'); },
    {enableHighAccuracy:true, maximumAge:5000, timeout:15000}
  );
}

/* поставить точку в текущем положении */
function addHere(){
  if(!lastPos){ useGeo(); return; }
  map.closePopup();
  closeSheet();
  setPicked(lastPos.coords.latitude, lastPos.coords.longitude);
}

/* ---------- маркер ---------- */
function fieldMarker(rec, pending){
  const key = String(rec['слой']||'заметка').trim().toLowerCase();
  const color = FIELD_COLORS[key] || FIELD_COLORS['заметка'];
  const done = String(rec['статус']||'').trim().toLowerCase().startsWith('провер');
  const rows = [];
  if(rec['цена'])          rows.push(['Цена', rec['цена']]);
  if(rec['слой'])          rows.push(['Слой', rec['слой']]);
  if(rec['статус'])        rows.push(['Статус', done
                              ? '<b style="color:#1B6B3A">проверено</b>'
                              : '<b style="color:#C2632F">требует проверки</b>']);
  if(rec['что_проверить']) rows.push(['Проверить', rec['что_проверить']]);
  if(rec['дата_записи'])   rows.push(['Записано', String(rec['дата_записи']).slice(0,10)]);
  if(rec['автор'])         rows.push(['Кто', rec['автор']]);

  let note = rec['комментарий'] ? '<b>С выезда:</b><br>'+rec['комментарий'] : '';
  if(!pending && rec['id']){
    FIELD_INDEX[rec['id']] = rec;
    note += '<div class="fpAct">'+
      '<button onclick="editPoint(\'' + rec['id'] + '\')">Изменить</button>'+
      '<button class="del" onclick="hidePoint(\'' + rec['id'] + '\')">Убрать с карты</button></div>';
  }
  const sub = pending ? 'Полевая заметка · ещё не отправлена' : 'Полевая заметка';

  return L.marker([parseFloat(rec['широта']), parseFloat(rec['долгота'])],{
    icon:L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],
      html:'<div style="width:24px;height:24px;border-radius:50%;background:'+color+
        ';border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4);opacity:'+(pending?'.55':'1')+
        ';display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px/1 Arial">'+
        (pending?'…':(done?'✓':'!'))+'</div>'})
  }).bindPopup(pop(rec['название']||'Без названия', sub, rows, note),{maxWidth:330});
}

/* ---------- очередь на случай отсутствия сети ---------- */
function queueGet(){ try{ return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]'); }catch(e){ return []; } }
function queueSet(a){ try{ localStorage.setItem(QUEUE_KEY, JSON.stringify(a)); }catch(e){} }
function queueAdd(rec){ const q=queueGet(); q.push(rec); queueSet(q); paintQueue(); }

function paintQueue(){
  const q = queueGet();
  const b = document.getElementById('fpQueue');
  if(b){
    b.style.display = q.length ? 'block' : 'none';
    b.textContent = 'Не отправлено: ' + q.length + '. Нажмите, чтобы попробовать снова';
  }
  q.forEach(r => { if(!r['действие'] || r['действие']==='создать') fieldMarker(r, true).addTo(gField); });
}

async function flushQueue(){
  if(typeof FIELD_ENDPOINT === 'undefined' || !FIELD_ENDPOINT) return;
  let q = queueGet(); if(!q.length) return;
  const left = [];
  for(const rec of q){
    const sent = await sendOne(rec);
    if(!sent) left.push(rec);
  }
  queueSet(left);
  if(left.length < q.length) reloadPoints();
  paintQueue();
}

async function sendOne(rec){
  try{
    const body = new URLSearchParams();
    Object.keys(rec).forEach(k => body.append(k, rec[k] == null ? '' : rec[k]));
    await fetch(FIELD_ENDPOINT, {method:'POST', mode:'no-cors', body});
    return true;
  }catch(e){ return false; }
}

/* ---------- загрузка ---------- */
function reloadPoints(expect){
  // Apps Script записывает не мгновенно, поэтому опрашиваем несколько раз
  const tries = [1200, 2500, 4000, 7000];
  tries.forEach((ms, i) => setTimeout(() => {
    gField.clearLayers();
    loadFieldPoints(i === tries.length - 1 ? null : expect);
  }, ms));
}

function loadFieldPoints(expect){
  if(typeof FIELD_ENDPOINT === 'undefined' || !FIELD_ENDPOINT){
    setCount('адрес таблицы не задан'); paintQueue(); return;
  }
  fetch(FIELD_ENDPOINT + '?t=' + Date.now())
    .then(r => r.json())
    .then(d => {
      let ok = 0, found = false;
      (d.points||[]).forEach(rec => {
        const la = parseFloat(String(rec['широта']).replace(',','.'));
        const lo = parseFloat(String(rec['долгота']).replace(',','.'));
        if(isNaN(la)||isNaN(lo)||la<48||la>55||lo<82||lo>90) return;
        rec['широта']=la; rec['долгота']=lo;
        fieldMarker(rec).addTo(gField); ok++;
        if(expect && rec['название'] === expect['название']) found = true;
      });
      // точка ещё не доехала до таблицы — показываем её сразу, серой
      if(expect && !found){ fieldMarker(expect, true).addTo(gField); ok++; }
      setCount(ok); paintQueue();
    })
    .catch(() => { setCount('таблица недоступна'); paintQueue(); });
}
function setCount(v){ const el=document.getElementById('fieldCount'); if(el) el.textContent=v; }

/* ---------- выбор места ---------- */
function startPick(){
  pickMode = true;
  document.getElementById('fpSheet').style.display = 'none';
  document.getElementById('fpHint').style.display = 'block';
  map.getContainer().style.cursor = 'crosshair';
}
function stopPick(){
  pickMode = false;
  document.getElementById('fpHint').style.display = 'none';
  map.getContainer().style.cursor = '';
}
function setPicked(la, lo){
  pickedLatLng = {lat:la, lng:lo};
  if(pickMarker) map.removeLayer(pickMarker);
  pickMarker = L.marker([la,lo],{icon:L.divIcon({className:'',iconSize:[26,26],iconAnchor:[13,13],
    html:'<div style="width:26px;height:26px;border-radius:50%;background:#C2632F;border:3px solid #fff;'+
         'box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;'+
         'color:#fff;font:700 14px/1 Arial">+</div>'})}).addTo(map);
  document.getElementById('fpCoords').textContent = la.toFixed(5) + ', ' + lo.toFixed(5);
  openSheet();
}
function useGeo(){
  const s = document.getElementById('fpGeoState');
  if(!navigator.geolocation){ s.textContent = 'телефон не отдаёт координаты'; return; }
  s.textContent = 'определяю…';
  navigator.geolocation.getCurrentPosition(
    p => { s.textContent=''; map.setView([p.coords.latitude,p.coords.longitude],14);
           setPicked(p.coords.latitude, p.coords.longitude); },
    () => { s.textContent = 'не получилось, ткните в карту'; },
    {enableHighAccuracy:true, timeout:10000}
  );
}

/* ---------- панель ---------- */
function openSheet(){ document.getElementById('fpSheet').style.display='block'; }

function closeSheet(){
  document.getElementById('fpSheet').style.display='none';
  stopPick();
  if(pickMarker){ map.removeLayer(pickMarker); pickMarker=null; }
  pickedLatLng = null; editId = null;
  ['fpName','fpPrice','fpCheck','fpNote','fpAuthor'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const h=document.querySelector('#fpSheet h3');
  if(h) h.textContent='Новая точка';
  const b=document.getElementById('fpSave');
  if(b) b.textContent='Сохранить точку';
}

/* ---------- правка существующей ---------- */
function editPoint(id){
  const rec = FIELD_INDEX[id];
  if(!rec){ alert('Не нашёл эту точку, обновите страницу'); return; }

  editId = id;
  pickedLatLng = {lat: parseFloat(rec['широта']), lng: parseFloat(rec['долгота'])};
  map.closePopup();

  document.getElementById('fpName').value   = rec['название'] || '';
  document.getElementById('fpPrice').value  = rec['цена'] || '';
  document.getElementById('fpCheck').value  = rec['что_проверить'] || '';
  document.getElementById('fpNote').value   = rec['комментарий'] || '';
  document.getElementById('fpAuthor').value = rec['автор'] || '';
  document.getElementById('fpCoords').textContent =
    pickedLatLng.lat.toFixed(5) + ', ' + pickedLatLng.lng.toFixed(5);

  const layer = String(rec['слой']||'Заметка');
  document.querySelectorAll('input[name=fpLayer]').forEach(r=>{
    r.checked = r.value.toLowerCase() === layer.toLowerCase();
  });
  const done = String(rec['статус']||'').toLowerCase().startsWith('провер');
  document.querySelectorAll('input[name=fpStatus]').forEach(r=>{
    r.checked = (r.value === 'проверено') === done;
  });

  document.querySelector('#fpSheet h3').textContent = 'Правка точки';
  document.getElementById('fpSave').textContent = 'Сохранить изменения';
  document.getElementById('fpSheet').classList.remove('fpMin');
  paintGrip();
  openSheet();
}

async function hidePoint(id){
  const rec = FIELD_INDEX[id];
  const name = rec ? (rec['название']||'точку') : 'точку';
  if(!confirm('Убрать «'+name+'» с карты?\n\nСтрока останется в таблице, вернуть можно в любой момент.')) return;
  map.closePopup();
  const payload = {'действие':'скрыть','id':id,'автор':(rec&&rec['автор'])||''};
  const sent = await sendOne(payload);
  if(!sent) queueAdd(payload);
  reloadPoints();
}

/* ---------- сохранение ---------- */
async function saveField(){
  if(!pickedLatLng){ alert('Сначала укажите место: кнопка «Я сейчас здесь» или тап по карте'); return; }
  const name = document.getElementById('fpName').value.trim();
  if(!name){ alert('Напишите хотя бы название'); return; }

  const rec = {
    'название': name,
    'широта': pickedLatLng.lat.toFixed(6),
    'долгота': pickedLatLng.lng.toFixed(6),
    'слой': document.querySelector('input[name=fpLayer]:checked').value,
    'цена': document.getElementById('fpPrice').value.trim(),
    'статус': document.querySelector('input[name=fpStatus]:checked').value,
    'что_проверить': document.getElementById('fpCheck').value.trim(),
    'комментарий': document.getElementById('fpNote').value.trim(),
    'автор': document.getElementById('fpAuthor').value.trim()
  };

  if(editId){ rec['действие'] = 'изменить'; rec['id'] = editId; }
  else      { rec['дата_записи'] = new Date().toISOString(); }

  const btn = document.getElementById('fpSave');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Сохраняю…';

  const sent = await sendOne(rec);
  if(sent){
    if(!editId){
      // рисуем сразу, не дожидаясь ответа таблицы
      fieldMarker(rec, true).addTo(gField);
      map.setView([parseFloat(rec['широта']), parseFloat(rec['долгота'])], Math.max(map.getZoom(), 12));
    }
    reloadPoints(editId ? null : rec);
  } else {
    queueAdd(rec);
  }

  btn.disabled = false; btn.textContent = label;
  closeSheet();
}

/* ---------- запуск ---------- */
function initFieldUI(){
  buildGrip();
  buildMobileUI();
  map.on('click', e => { if(pickMode) setPicked(e.latlng.lat, e.latlng.lng); });
  document.getElementById('fpAdd').addEventListener('click', () => {
    closeSheet(); openSheet();
    document.getElementById('fpCoords').textContent='место не выбрано';
  });
  document.getElementById('fpGeo').addEventListener('click', useGeo);
  document.getElementById('fpPick').addEventListener('click', startPick);
  document.getElementById('fpClose').addEventListener('click', closeSheet);
  document.getElementById('fpSave').addEventListener('click', saveField);
  const q = document.getElementById('fpQueue');
  if(q) q.addEventListener('click', flushQueue);
  window.addEventListener('online', flushQueue);
  loadFieldPoints();
  flushQueue();
}

/* запуск после того, как карта построена и разметка готова */
window.addEventListener("load", initFieldUI);
