(() => {
  'use strict';
  if (window.__vaultCleanerLightggNative) return;
  window.__vaultCleanerLightggNative = true;
  const ID = /^\d{18,20}$/;
  const GRADE = /^(?:S|A|B|C|D|F)[+-]?$/;
  const APPLY = /^(?:equip popular perks|equip most popular perks|apply popular perks|equipar (?:los )?(?:perks|ventajas) (?:más )?populares|aplicar (?:los )?perks populares)$/i;
  function ownId(model) {
    if (!model || typeof model !== 'object') return null;
    for (const key of ['itemInstanceId','ItemInstanceId','instanceId','InstanceId','id','Id']) {
      const value = model[key];
      if (typeof value === 'string' && ID.test(value)) return value;
    }
    for (const key of ['Item','item','Weapon','weapon']) {
      const child = model[key];
      if (child && child !== model) {
        for (const field of ['itemInstanceId','ItemInstanceId','instanceId','InstanceId','id','Id']) if (typeof child[field] === 'string' && ID.test(child[field])) return child[field];
      }
    }
    return null;
  }
  function pathValue(scope, path) {
    if (!/^[$\w]+(?:\.[$\w]+){0,5}$/.test(path)) return null;
    let value = scope;
    for (const key of path.split('.')) {
      if (['__proto__','constructor','prototype'].includes(key) || !value || typeof value !== 'object') return null;
      value = value[key];
    }
    return value;
  }
  function boundModels(node) {
    const models = [];
    if (typeof window.angular?.element !== 'function') return models;
    // Only item bindings near this element; never search account/session objects.
    for (let el = node, depth = 0; el && el !== document.body && depth < 8; el = el.parentElement, depth++) {
      let scope;
      try { const wrapped = window.angular.element(el); scope = wrapped.scope?.() || wrapped.isolateScope?.(); } catch { continue; }
      if (!scope) continue;
      const binding = el.getAttribute('ng-click') || el.getAttribute('data-ng-click') || '';
      const argument = binding.match(/\(\s*([$\w]+(?:\.[$\w]+){0,5})\s*(?:,|\))/)?.[1];
      if (argument) { const value = pathValue(scope, argument); if (ownId(value)) models.push(value); }
      const repeat = (el.getAttribute('ng-repeat') || el.getAttribute('data-ng-repeat') || '').match(/^\s*([$\w]+)\s+in\s/);
      if (repeat) { const value = pathValue(scope, repeat[1]); if (ownId(value)) models.push(value); }
      for (const key of ['Roll','roll','SelectedRoll','selectedRoll','CurrentRoll','currentRoll','InspectedRoll','inspectedRoll','SelectedItem','selectedItem','Item','item','Weapon','weapon','vm.SelectedRoll','vm.selectedRoll','vm.selectedItem']) {
        const value = pathValue(scope,key); if (ownId(value)) models.push(value);
      }
      if (models.length) break;
    }
    return [...new Set(models)];
  }
  function metadata(model) {
    const result = {};
    for (const key of Object.keys(model).slice(0,100)) {
      const value = model[key];
      if (/higher.*rank|can.*(?:improve|optimi)|needs.*(?:popular|perk)/i.test(key) && typeof value === 'boolean') result.higherRankPossible = value;
      if (typeof value !== 'string' || !GRADE.test(value.toUpperCase())) continue;
      if (/best|max|highest/i.test(key) && /rank|grade|quality/i.test(key)) result.bestGrade = value.toUpperCase();
      else if (/current|equipped|selected/i.test(key) && /rank|grade|quality/i.test(key)) result.currentGrade = value.toUpperCase();
    }
    return result;
  }
  function directIdentity(button, id) {
    for (let el = button, depth = 0; el && el !== document.body && depth < 8; el = el.parentElement, depth++) {
      const own = [...el.attributes].filter(a=>!/owner|character|membership|account|^data-vc-/.test(a.name)).flatMap(a=>a.value.length<=768 ? [...a.value.matchAll(/(?<!\d)\d{18,20}(?!\d)/g)].map(m=>m[0]) : []);
      if (!own.includes(id)) continue;
      const all = new Set(); let count=0;
      const tree = document.createTreeWalker(el,NodeFilter.SHOW_ELEMENT);let n=el;
      while(n && count++<1500) {
        for (const a of [...n.attributes].slice(0,32)) if (!/owner|character|membership|account|^data-vc-|^on|^value$/.test(a.name) && a.value.length<=768) for (const m of a.value.matchAll(/(?<!\d)\d{18,20}(?!\d)/g)) all.add(m[0]);
        if (all.size>1) return false;
        n=tree.nextNode();
      }
      return !n && all.size===1 && all.has(id);
    }
    return false;
  }
  document.addEventListener('vc-lightgg-native-request', event => {
    let request; try { request=JSON.parse(event.detail); } catch { return; }
    const reply = data => document.dispatchEvent(new CustomEvent('vc-lightgg-native-response',{detail:JSON.stringify({requestId:request.requestId,...data})}));
    try {
      if (request.kind==='ping') { reply({ok:true}); return; }
      if (!ID.test(request.id) || !/^[a-z0-9-]{12,60}$/.test(request.token)) throw new Error('Identificador de acción inválido.');
      const node = event.target instanceof Element && event.target.getAttribute('data-vc-native-token')===request.token ? event.target : null;
      if (!node) throw new Error('El control de light.gg cambió.');
      const models=boundModels(node), ids=new Set(models.map(ownId));
      const exactModel = ids.size===1 && ids.has(request.id) ? models[0] : null;
      if (request.kind==='read') {
        reply({ok:true,metadata:exactModel ? metadata(exactModel) : {}}); return;
      }
      const text = (node.textContent || '').trim().replace(/\s+/g,' ');
      const label = node.getAttribute('aria-label') || node.getAttribute('title') || text;
      if (request.kind!=='apply' || !node.matches('button, [role="button"], [ng-click], [data-ng-click]') || !(APPLY.test(text) || APPLY.test(label))) throw new Error('No se reconoció Equip Popular Perks.');
      if (!node.isConnected || !node.getClientRects().length || node.disabled || node.getAttribute('aria-disabled')==='true') throw new Error('El control nativo no está disponible.');
      if (ids.size && !exactModel) throw new Error('El inspector corresponde a otra copia.');
      if (!exactModel && !directIdentity(node,request.id)) throw new Error('No se pudo verificar la copia del arma en el control nativo.');
      node.click();
      // Click submission is not a Bungie success acknowledgement.
      reply({ok:true,status:'submitted'});
    } catch(error) { reply({ok:false,error:error.message}); }
  });
})();
