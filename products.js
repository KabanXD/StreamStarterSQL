(function () {
  'use strict';

  // DOM refs
  const qs = new URLSearchParams(location.search);
  const productId = qs.get('id') ? Number(qs.get('id')) : null;
  const productArea = document.getElementById('productArea');
  const breadcrumbs = document.getElementById('breadcrumbs');
  const recommendedWrap = document.getElementById('recommendedWrap');
  const recommendedEl = document.getElementById('recommended');
  const notFound = document.getElementById('notFound');

  // Cart DOM
  const cartCountEl = document.getElementById('cartCount');
  const cartBtn = document.getElementById('cartBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const closeCart = document.getElementById('closeCart');
  const overlay = document.getElementById('overlay');
  const cartItemsUl = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartTotal = document.getElementById('cartTotal');

  // App state
  const state = {
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    products: []
  };

  /* ===========================
     Utilities
  ============================ */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  /* ===========================
     Cart logic + UI
  ============================ */
  function updateCartUI() {
    const qty = state.cart.reduce((s, i) => s + i.qty, 0);
    if (qty > 0) {
      cartCountEl.hidden = false;
      cartCountEl.textContent = qty;
    } else {
      cartCountEl.hidden = true;
    }

    cartItemsUl.innerHTML = '';
    if (state.cart.length === 0) {
      cartEmpty.style.display = 'block';
      cartTotal.textContent = '0 ₽';
    } else {
      cartEmpty.style.display = 'none';
      let sum = 0;
      state.cart.forEach(item => {
        const p = state.products.find(x => x.id === item.id) || {};
        sum += (p.price || 0) * item.qty;
        const li = document.createElement('li');
        li.style.padding = '8px 0';
        li.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
            <div><strong>${escapeHtml(p.name || 'Товар')}</strong><div class="muted" style="font-size:13px">${(p.price||0).toLocaleString()} ₽ × ${item.qty}</div></div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="icon-btn small dec" data-id="${item.id}">−</button>
              <button class="icon-btn small inc" data-id="${item.id}">＋</button>
            </div>
          </div>`;
        cartItemsUl.appendChild(li);
      });
      cartTotal.textContent = `${sum.toLocaleString()} ₽`;
    }
  }

  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartUI();
  }

  function addToCart(id, qty = 1) {
    const found = state.cart.find(i => i.id === id);
    if (found) found.qty += qty;
    else state.cart.push({ id, qty });
    saveCart();
  }

  // Cart drawer interactions
  cartItemsUl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.classList.contains('inc')) {
      const it = state.cart.find(x => x.id === id); if (it) it.qty++;
      saveCart();
    } else if (btn.classList.contains('dec')) {
      const it = state.cart.find(x => x.id === id);
      if (it) {
        it.qty--;
        if (it.qty <= 0) state.cart = state.cart.filter(x => x.id !== id);
        saveCart();
      }
    }
  });

  cartBtn && cartBtn.addEventListener('click', () => {
    cartDrawer.style.transform = 'translateX(0)';
    cartDrawer.setAttribute('aria-hidden', 'false');
    overlay.hidden = false;
  });
  closeCart && closeCart.addEventListener('click', () => {
    cartDrawer.style.transform = 'translateX(100%)';
    cartDrawer.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
  });
  overlay && overlay.addEventListener('click', () => {
    cartDrawer.style.transform = 'translateX(100%)';
    cartDrawer.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
  });

  /* ===========================
     Data loading
  ============================ */
  async function loadProductsJson() {
    try {
      const r = await fetch('products.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('products.json not found');
      const json = await r.json();
      state.products = Array.isArray(json) ? json : [];
    } catch (err) {
      console.warn('Не удалось загрузить products.json:', err);
      state.products = [];
    }
    // expose for debugging if needed
    window._ALL_PRODUCTS = state.products;
  }

  /* ===========================
     Render helpers
  ============================ */

  function showNotFound() {
    productArea.style.display = 'none';
    notFound.style.display = '';
    recommendedWrap.style.display = 'none';
  }

  function renderBreadcrumbs(prod) {
    breadcrumbs.innerHTML = `
      <a href="/catalog" class="link-underline">Каталог</a>
      <span class="muted">/</span>
      <a href="/catalog?cat=${encodeURIComponent(prod.category)}" class="muted">${escapeHtml(prod.category)}</a>
      <span class="muted">/</span>
      <div style="font-weight:700">${escapeHtml(prod.name)}</div>
    `;
  }

  function buildThumbs(p) {
    const thumbs = [];
    if (!p.thumb && (!p.images || p.images.length === 0)) {
      thumbs.push('placeholder.png');
      return thumbs;
    }
    // prefer explicit images array
    if (Array.isArray(p.images) && p.images.length > 0) {
      p.images.slice(0, 6).forEach(img => thumbs.push(img));
      return thumbs;
    }
    // fallback: use p.thumb and derive variants
    thumbs.push(p.thumb);
    const m = /(.+?)([-_]?0?1)(\.\w+)$/.exec(p.thumb);
    if (m) {
      const base = m[1];
      const ext = m[3];
      thumbs.push(base + (m[2].replace(/1$/, '2')) + ext);
      thumbs.push(base + (m[2].replace(/1$/, '3')) + ext);
    } else {
      const dot = p.thumb.lastIndexOf('.');
      const base = dot !== -1 ? p.thumb.slice(0, dot) : p.thumb;
      const ext = dot !== -1 ? p.thumb.slice(dot) : '';
      thumbs.push(base + '-2' + ext);
      thumbs.push(base + '-3' + ext);
    }
    return Array.from(new Set(thumbs)).slice(0, 6);
  }

  function renderProduct(p) {
    const thumbs = buildThumbs(p);
    const html = `
      <section class="product-hero" style="display:grid; grid-template-columns: 1fr 420px; gap:28px; align-items:start;">
        <div class="gallery">
          <div class="main-image" id="mainImageWrap">
            <img id="mainImage" src="${escapeAttr(thumbs[0])}" alt="${escapeAttr(p.name)}" onerror="this.src='placeholder.png'"/>
          </div>
          <div class="thumbs" id="thumbs">
            ${thumbs.map((t, i) => `<button class="thumb ${i===0?'active':''}" data-src="${escapeAttr(t)}" aria-label="Миниатюра ${i+1}"><img src="${escapeAttr(t)}" alt="" onerror="this.src='placeholder.png'"/></button>`).join('')}
          </div>
        </div>

        <aside class="product-info panel" aria-labelledby="prodTitle">
          <div class="top">
            <div class="p-tags">
              ${p.tag ? `<span class="badge">${escapeHtml(p.tag)}</span>` : ''}
              <span class="muted" style="margin-left:8px">${escapeHtml(p.brand)} · ${escapeHtml(p.category)}</span>
            </div>
            <h1 id="prodTitle" style="margin:10px 0 6px 0">${escapeHtml(p.name)}</h1>
            <div class="p-sub muted">${escapeHtml(p.desc || p.description || '')}</div>
          </div>

          <div class="purchase">
            <div class="price-row" style="display:flex;align-items:center;gap:12px;margin-top:12px">
              <div class="price" style="font-size:28px;font-weight:900">${Number(p.price).toLocaleString()} ₽</div>
              <div class="muted">${p.available ? 'Есть в наличии' : 'Нет в наличии'}</div>
            </div>

            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <button id="addToCartBtn" class="p-add" ${p.available ? '' : 'disabled'}>🛒 Добавить в корзину</button>
              <button id="buyNowBtn" class="cta ghost" style="padding:10px 14px;border-radius:10px">Купить в 1 клик</button>
              <a href="/catalog?cat=${encodeURIComponent(p.category)}" class="cta ghost" style="padding:10px 14px;border-radius:10px">Другие в категории</a>
            </div>

            <div style="margin-top:12px" class="small muted">Доставка 2–4 дня · Гарантия 14 дней</div>
          </div>

          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.03);margin:16px 0" />

          <div class="specs">
            <h4 style="margin:0 0 8px 0">Характеристики</h4>
            <table class="spec-table" style="width:100%">
              <tr><td>Категория</td><td>${escapeHtml(p.category)}</td></tr>
              <tr><td>Бренд</td><td>${escapeHtml(p.brand)}</td></tr>
              <tr><td>Доступность</td><td>${p.available ? 'В наличии' : 'Нет в наличии'}</td></tr>
              <tr><td>Цена</td><td>${Number(p.price).toLocaleString()} ₽</td></tr>
            </table>
          </div>
        </aside>
      </section>

      <section class="product-tabs" style="margin-top:22px">
        <div class="tabs">
          <button class="tab-btn active" data-tab="desc">Описание</button>
          <button class="tab-btn" data-tab="tech">Технические</button>
          <button class="tab-btn" data-tab="reviews">Отзывы</button>
        </div>

        <div class="tab-panels" style="margin-top:12px">
          <div class="tab-panel" id="desc">
            <h3>О товаре</h3>
            <p>${escapeHtml(p.desc || p.description || '')}</p>
          </div>

          <div class="tab-panel" id="tech" style="display:none">
            <h3>Технические данные</h3>
            <p class="muted">Дополнительные технические данные можно добавить здесь.</p>
          </div>

          <div class="tab-panel" id="reviews" style="display:none">
            <h3>Отзывы</h3>
            <p class="muted">Пусто — ещё нет отзывов.</p>
          </div>
        </div>
      </section>
    `;
    productArea.innerHTML = html;

    // gallery interactions
    const thumbsWrap = document.getElementById('thumbs');
    if (thumbsWrap) {
      thumbsWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('button.thumb');
        if (!btn) return;
        const src = btn.dataset.src;
        const main = document.getElementById('mainImage');
        if (main && src) main.src = src;
        thumbsWrap.querySelectorAll('button.thumb').forEach(x => x.classList.toggle('active', x === btn));
      });
    }

    // add to cart button
    const addBtn = document.getElementById('addToCartBtn');
    addBtn && addBtn.addEventListener('click', () => {
      addToCart(p.id, 1);
      addBtn.textContent = '✓ Добавлено';
      setTimeout(() => addBtn.textContent = '🛒 Добавить в корзину', 900);
    });

    // tabs
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const tab = b.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(panel => panel.style.display = panel.id === tab ? '' : 'none');
      });
    });

    // show product area and recommended
    recommendedWrap.style.display = '';
  }

  function renderRecommended(current) {
    const all = state.products || [];
    const same = all.filter(x => x.category === current.category && x.id !== current.id);
    let list = same.slice(0, 4);
    if (list.length < 4) {
      const others = all.filter(x => x.id !== current.id && !list.some(y => y.id === x.id));
      others.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      list = list.concat(others.slice(0, 4 - list.length));
    }

    recommendedEl.innerHTML = '';
    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-top">
          <a class="product-link" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeAttr(p.name)}">
            <img src="${escapeAttr(p.thumb || 'placeholder.png')}" alt="${escapeAttr(p.name)}" onerror="this.src='placeholder.png'"/>
          </a>
          ${p.tag ? `<span class="p-badge">${escapeHtml(p.tag)}</span>` : ''}
          ${!p.available ? `<span class="oos">Нет в наличии</span>` : ''}
        </div>
        <div class="product-body">
          <a class="product-link" href="product.html?id=${encodeURIComponent(p.id)}" style="text-decoration:none;color:inherit"><h3 class="p-title">${escapeHtml(p.name)}</h3></a>
          <div class="muted" style="font-size:13px">${escapeHtml(p.brand)} · ${escapeHtml(p.category)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
            <div class="p-price">${Number(p.price).toLocaleString()} ₽</div>
            <div class="p-actions">
              <button class="p-add rec-add" data-id="${p.id}" ${!p.available ? 'disabled' : ''}>🛒</button>
            </div>
          </div>
        </div>
      `;
      recommendedEl.appendChild(card);
    });
  }

  // delegate recommended 'add' clicks once
  recommendedEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button.rec-add');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    addToCart(id, 1);
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = '🛒', 600);
  });

  /* ===========================
     Boot
  ============================ */
  async function boot() {
    await loadProductsJson();

    if (!productId) {
      showNotFound();
      updateCartUI();
      return;
    }

    const prod = state.products.find(p => Number(p.id) === Number(productId));
    if (!prod) {
      showNotFound();
      updateCartUI();
      return;
    }

    renderBreadcrumbs(prod);
    renderProduct(prod);
    renderRecommended(prod);
    updateCartUI();
  }

  // initial data load
  async function loadProductsJson() {
    try {
      const r = await fetch('products.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('products.json not found');
      const json = await r.json();
      state.products = Array.isArray(json) ? json : [];
    } catch (err) {
      console.warn('Не удалось загрузить products.json:', err);
      state.products = [];
    }
    window._ALL_PRODUCTS = state.products;
  }

  // run
  document.addEventListener('DOMContentLoaded', boot);

})();
