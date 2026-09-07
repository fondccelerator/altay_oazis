/* ============ ПОЛЕВЫЕ ЗАМЕТКИ ============
   Точки, которые Ольга ставит прямо с телефона.
   Хранятся в Google Таблице, адрес задан в config.js.
   Если сети нет, запись ложится в память телефона и уходит сама, когда связь появится.
   ========================================= */

const FIELD_COLORS = {
  'земля':'#C9A227','объект':'#1B3A2F','застройщик':'#2E5545',
  'риск':'#9E2B25','заметка':'#6B8578'
};
const QUEUE_KEY = 'altay_field_queue';
const gField = L.layerGroup();

let pickMode = false, pickedLatLng = null, pickMarker = null;

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
  const note = rec['комментарий'] ? '<b>С выезда:</b><br>'+rec['комментарий'] : '';
  const sub = pending ? 'Полевая заметка · ещё не отправлена' : 'Полевая заметка';

  return L.marker([parseFloat(rec['широта']), parseFloat(rec['долгота'])],{
    icon:L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],
      html:'<div style="width:24px;height:24px;border-radius:50%;background:'+color+
        ';border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4);opacity:'+(pending?'.55':'1')+
        ';display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px/1 Arial">'+
        (pending?'…':(done?'✓':'!'))+'</div>'})
  }).bindPopup(pop(rec['название']||'Без названия', sub, rows, note),{maxWidth:330});
}

/* ---------- очередь ---------- */
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
  q.forEach(r => fieldMarker(r, true).addTo(gField));
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
  if(left.length < q.length){ gField.clearLayers(); loadFieldPoints(); }
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
function loadFieldPoints(){
  if(typeof FIELD_ENDPOINT === 'undefined' || !FIELD_ENDPOINT){
    setCount('адрес таблицы не задан'); paintQueue(); return;
  }
  fetch(FIELD_ENDPOINT + '?t=' + Date.now())
    .then(r => r.json())
    .then(d => {
      let ok = 0;
      (d.points||[]).forEach(rec => {
        const la = parseFloat(String(rec['широта']).replace(',','.'));
        const lo = parseFloat(String(rec['долгота']).replace(',','.'));
        if(isNaN(la)||isNaN(lo)||la<48||la>55||lo<82||lo>90) return;
        rec['широта']=la; rec['долгота']=lo;
        fieldMarker(rec).addTo(gField); ok++;
      });
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
  pickedLatLng = null;
  ['fpName','fpPrice','fpCheck','fpNote','fpAuthor'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
}

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
    'автор': document.getElementById('fpAuthor').value.trim(),
    'дата_записи': new Date().toISOString()
  };

  const btn = document.getElementById('fpSave');
  btn.disabled = true; btn.textContent = 'Сохраняю…';

  const sent = await sendOne(rec);
  if(sent){
    setTimeout(()=>{ gField.clearLayers(); loadFieldPoints(); }, 1200);
  } else {
    queueAdd(rec);
  }

  btn.disabled = false; btn.textContent = 'Сохранить точку';
  closeSheet();
}

/* ---------- запуск ---------- */
function initFieldUI(){
  map.on('click', e => { if(pickMode) setPicked(e.latlng.lat, e.latlng.lng); });
  document.getElementById('fpAdd').addEventListener('click', () => {
    if(pickedLatLng) openSheet(); else { openSheet(); document.getElementById('fpCoords').textContent='место не выбрано'; }
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
