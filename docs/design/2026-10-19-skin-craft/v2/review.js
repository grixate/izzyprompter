document.querySelectorAll('article[data-skin]').forEach(card=>{
  card.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    const active=button.getAttribute('aria-pressed')!=='true';
    card.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
    button.setAttribute('aria-pressed',String(active));
    const before=active&&button.dataset.action==='before', run=active&&button.dataset.action==='run';
    const src=before?`before/${card.dataset.skin}.png`:`references/${card.dataset.skin}-${run?'running':'paired'}.png`;
    const image=card.querySelector('img');image.src=src;image.parentElement.href=src;
    const state=before?'Предыдущая версия · HOLD':`Версия 2 · ${run?'RUN':'HOLD'}`;
    card.querySelector('figcaption').textContent=state;image.alt=card.querySelector('h3').textContent+' · '+state;
    card.querySelectorAll('button').forEach(b=>b.textContent=b.dataset.action==='before'?(b===button&&active?'Вернуться к версии 2':'Сравнить с предыдущей'):(b===button&&active?'Показать HOLD':'Показать RUN'));
  }));
});
