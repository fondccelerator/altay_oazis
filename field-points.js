/* ================= ПОЛЕВЫЕ ЗАМЕТКИ: points.csv =================
   Файл points.csv лежит рядом с index.html и правится через сайт GitHub.
   Одна строка = одна точка. Разделитель — точка с запятой.
   Битая строка не ломает карту: она пропускается, счётчик её покажет.
================================================================= */
const gField = L.layerGroup();

const FIELD_COLORS = {
  'земля':      '#C9A227',
  'объект':     '#1B3A2F',
  'застройщик': '#2E5545',
  'риск':       '#9E2B25',
  'заметка':    '#6B8578'
};

function fieldMarker(rec){
  const key   = (rec['слой']||'заметка').trim().toLowerCase();
  const color = FIELD_COLORS[key] || FIELD_COLORS['заметка'];
  const done  = (rec['статус']||'').trim().toLowerCase().startsWith('провер');
  const rows  = [];
  if(rec['цена'])          rows.push(['Цена', rec['цена']]);
  if(rec['слой'])          rows.push(['Слой', rec['слой']]);
  if(rec['статус'])        rows.push(['Статус', done ? '<b style="color:#1B6B3A">проверено</b>'
                                                     : '<b style="color:#C2632F">требует проверки</b>']);
  if(rec['что_проверить']) rows.push(['Проверить', rec['что_проверить']]);
  if(rec['дата'])          rows.push(['Дата записи', rec['дата']]);

  const note = rec['комментарий']
    ? '<b>Заметка с выезда:</b><br>' + rec['комментарий']
    : '';

  return L.marker([parseFloat(rec['широта']), parseFloat(rec['долгота'])], {
    icon: L.divIcon({
      className:'', iconSize:[22,22], iconAnchor:[11,11],
      html:'<div style="width:22px;height:22px;border-radius:50%;background:'+color+
           ';border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4);'+
           'display:flex;align-items:center;justify-content:center;'+
           'color:#fff;font:700 11px/1 Arial">'+(done?'✓':'!')+'</div>'
    })
  }).bindPopup(pop(rec['название']||'Без названия', 'Полевая заметка', rows, note), {maxWidth:330});
}

function parseCsvLine(line){
  // точка с запятой как разделитель; кавычки не обязательны
  return line.split(';').map(s=>s.trim().replace(/^"|"$/g,''));
}

function loadFieldPoints(){
  fetch('points.csv?v=' + Date.now())
    .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(text => {
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if(lines.length < 2){ updateFieldCount(0,0); return; }
      const head = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      let ok = 0, bad = 0;
      const problems = [];
      for(let i = 1; i < lines.length; i++){
        try{
          const cells = parseCsvLine(lines[i]);
          const rec = {};
          head.forEach((h, j) => rec[h] = cells[j] || '');
          const la = parseFloat(String(rec['широта']).replace(',', '.'));
          const lo = parseFloat(String(rec['долгота']).replace(',', '.'));
          if(isNaN(la) || isNaN(lo) || la < 48 || la > 55 || lo < 82 || lo > 90){
            throw new Error('координаты вне Алтая или не число');
          }
          rec['широта'] = la; rec['долгота'] = lo;
          fieldMarker(rec).addTo(gField);
          ok++;
        }catch(e){
          bad++;
          problems.push('строка ' + (i + 1) + ': ' + e.message);
        }
      }
      updateFieldCount(ok, bad, problems);
    })
    .catch(e => updateFieldCount(0, 0, ['файл points.csv не загрузился: ' + e.message]));
}

function updateFieldCount(ok, bad, problems){
  const el = document.getElementById('fieldCount');
  if(el) el.textContent = ok + (bad ? ' · ' + bad + ' с ошибкой' : '');
  const w = document.getElementById('fieldWarn');
  if(w){
    if(bad || (problems && problems.length && !ok)){
      w.style.display = 'block';
      w.innerHTML = 'Не удалось прочитать: ' + (problems || []).join('; ');
    } else {
      w.style.display = 'none';
    }
  }
}

loadFieldPoints();
