/* Адрес Google Таблицы, куда карта пишет и откуда читает полевые точки.
   Таблица живёт на аккаунте fond.ccelerator@gmail.com.
   Если адрес когда-нибудь поменяется: Таблица → Расширения → Apps Script →
   Deploy → Manage deployments → скопировать ссылку, заканчивающуюся на /exec. */
const FIELD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwZIWt0pmWCdduvlPzPeIdjnrpdI7gI22fxT1bxFYXltpTOJSOhyfZpKZIf7gKWkxlM/exec';


/* ===== Приглашение включить геопозицию =====
   Показывается один раз при входе. Если разрешение уже дано, слежение
   включается молча. Если закрыто — объясняем, где именно его вернуть:
   открыть настройки браузера за пользователя сайт не может, так устроена защита. */
(function(){
  const KEY = 'altay_geo_asked';

  function banner(title, html, buttons){
    const old = document.getElementById('fpGeoAsk');
    if(old) old.remove();
    const b = document.createElement('div');
    b.id = 'fpGeoAsk';
    b.innerHTML = '<b>' + title + '</b><p>' + html + '</p><div class="acts"></div>';
    const acts = b.querySelector('.acts');
    buttons.forEach(function(item){
      const btn = document.createElement('button');
      btn.textContent = item[0];
      if(item[2]) btn.className = 'main';
      btn.addEventListener('click', function(){ b.remove(); item[1](); });
      acts.appendChild(btn);
    });
    document.body.appendChild(b);
  }

  function turnOn(){
    const btn = document.getElementById('fpGeoBtn');
    if(btn && !btn.classList.contains('on')) btn.click();
  }

  function showDenied(){
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const how = ios
      ? 'Нажмите <b>аА</b> слева в адресной строке → <b>Настройки для этого веб-сайта</b> → <b>Геопозиция</b> → Разрешить.'
      : 'Нажмите на <b>замок</b> слева в адресной строке → <b>Разрешения</b> → <b>Геоданные</b> → Разрешить.';
    banner('Доступ к геопозиции закрыт',
      how + '<br><br>Открыть эти настройки за вас браузер не даёт. Но место всегда можно указать тапом по карте.',
      [['Я разрешила, обновить', function(){ location.reload(); }, true],
       ['Обойдусь без этого', function(){}]]);
  }

  function showAsk(){
    banner('Показывать, где вы на карте?',
      'Тогда координаты новой точки подставятся сами, и не придётся искать место пальцем.',
      [['Разрешить', turnOn, true],
       ['Не сейчас', function(){ try{ sessionStorage.setItem(KEY, 'no'); }catch(e){} }]]);
  }

  async function init(){
    if(!navigator.geolocation) return;

    let state = 'unknown';
    if(navigator.permissions && navigator.permissions.query){
      try{
        const st = await navigator.permissions.query({name:'geolocation'});
        state = st.state;
        // если разрешение поменяли в настройках, подхватим без перезагрузки
        st.onchange = function(){
          if(st.state === 'granted'){
            const old = document.getElementById('fpGeoAsk');
            if(old) old.remove();
            turnOn();
          }
        };
      }catch(e){ /* Safari до 16 не умеет querying геолокации */ }
    }

    if(state === 'granted'){ turnOn(); return; }
    if(state === 'denied'){ showDenied(); return; }
    try{ if(sessionStorage.getItem(KEY) === 'no') return; }catch(e){}
    showAsk();
  }

  // ждём, пока карта построится и появится кнопка слежения
  window.addEventListener('load', function(){ setTimeout(init, 900); });
})();
