/* =============================================
   EverPaws — Main JavaScript
   ============================================= */

'use strict';

// ─── Navbar ────────────────────────────────────
const navbar = document.querySelector('.navbar');
if (navbar) {
  function updateNavbar() {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
      navbar.classList.remove('navbar-transparent');
    } else {
      navbar.classList.remove('scrolled');
      if (document.body.classList.contains('hero-page')) {
        navbar.classList.add('navbar-transparent');
      }
    }
  }
  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();
}

// ─── Mobile Nav ────────────────────────────────
const hamburger = document.querySelector('.hamburger');
const mobileNav = document.querySelector('.mobile-nav');
const mobileOverlay = document.querySelector('.mobile-overlay');

function closeMobileNav() {
  mobileNav?.classList.remove('open');
  mobileOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

hamburger?.addEventListener('click', () => {
  const isOpen = mobileNav?.classList.contains('open');
  if (isOpen) {
    closeMobileNav();
  } else {
    mobileNav?.classList.add('open');
    mobileOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
});
mobileOverlay?.addEventListener('click', closeMobileNav);

// ─── Active Nav Link ────────────────────────────
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-link').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPath || (currentPath === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

// ─── Intersection Observer (Fade animations) ───
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-up, .fade-in').forEach(el => observer.observe(el));

// ─── Cart UI ─────────────────────────────────────
// Reads from ShopifyCart (defined in shopify.js) and renders the sidebar.

function updateCartUI() {
  const lines = ShopifyCart.getLines();
  const count = ShopifyCart.getTotalCount();

  // Badge on cart icon
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });

  const cartBody  = document.querySelector('.cart-body');
  const cartTotal = document.querySelector('.cart-total-amount');
  const checkoutBtn = document.querySelector('.cart-footer .btn-primary');

  if (!cartBody) return;

  if (lines.length === 0) {
    cartBody.innerHTML = `
      <div class="cart-empty">
        <div class="icon">🐾</div>
        <p>Your cart is empty.<br>Browse our memorial collection to find the perfect tribute.</p>
      </div>`;
    if (cartTotal) cartTotal.textContent = '$0.00';
    if (checkoutBtn) checkoutBtn.setAttribute('href', '#');
    return;
  }

  cartBody.innerHTML = lines.map(line => {
    const product  = line.merchandise.product;
    const variant  = line.merchandise;
    const imgUrl   = product.featuredImage?.url || '';
    const unitCost = parseFloat(variant.price.amount);
    const lineCost = (unitCost * line.quantity).toFixed(2);
    const varLabel = variant.title !== 'Default Title' ? variant.title : '';
    return `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${imgUrl}" alt="${product.title}" loading="lazy">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${product.title}</div>
          ${varLabel ? `<div class="cart-item-meta">${varLabel}</div>` : ''}
          <div class="cart-item-row">
            <span class="cart-item-price">$${lineCost}</span>
            <button class="cart-remove" data-line-id="${line.id}">Remove</button>
          </div>
        </div>
      </div>`;
  }).join('');

  if (cartTotal) cartTotal.textContent = ShopifyCart.getTotal();
  if (checkoutBtn) checkoutBtn.setAttribute('href', ShopifyCart.getCheckoutUrl());

  cartBody.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      try {
        await ShopifyCart.removeItem(btn.dataset.lineId);
      } catch {
        showToast('Could not remove item — please try again.', '');
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
    });
  });
}

// Re-render whenever ShopifyCart fires an update
window.addEventListener('cart:updated', updateCartUI);

// ─── Add to Cart ─────────────────────────────────
async function addToCart(item) {
  const variantId = window.VARIANT_MAP?.[item.id];

  // Dev/demo mode: Shopify not wired up yet
  if (!variantId || variantId.includes('REPLACE_ME')) {
    showToast(`✓  "${item.name}" added (connect Shopify to enable checkout)`, 'success');
    openCart();
    return;
  }

  try {
    showToast('Adding to cart…', '');
    await ShopifyCart.addItem(variantId, item.qty || 1);
    showToast(`✓  "${item.name}" added to your cart`, 'success');
    openCart();
  } catch (err) {
    console.error('addToCart error:', err);
    showToast('Could not add to cart — please try again.', '');
  }
}

// ─── Cart Sidebar ───────────────────────────────
const cartSidebar = document.querySelector('.cart-sidebar');

function openCart() {
  cartSidebar?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  cartSidebar?.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.nav-icon[data-cart]').forEach(btn => btn.addEventListener('click', openCart));
document.querySelector('.cart-close')?.addEventListener('click', closeCart);

// Expose for HTML onclick attributes
window.openCart  = openCart;
window.closeCart = closeCart;
window.addToCart = addToCart;

// Load existing cart on page start
ShopifyCart.init().then(updateCartUI);

// ─── Toast Notification ─────────────────────────
function showToast(message, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '🐾' : 'ℹ️'}</span> ${message}`;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}
window.showToast = showToast;

// ─── Quick View Modal ───────────────────────────
const modalOverlay = document.querySelector('.modal-overlay');

function openQuickView(product) {
  if (!modalOverlay) return;
  const modalBody = modalOverlay.querySelector('.modal-body');
  const modalImg  = modalOverlay.querySelector('.modal-image img');
  if (modalImg) modalImg.src = product.image;
  if (modalBody) {
    modalBody.innerHTML = `
      <span class="product-category">${product.category}</span>
      <h3 style="margin:8px 0 12px">${product.name}</h3>
      <div class="stars" style="margin-bottom:12px">★★★★★</div>
      <div class="product-price-large" style="font-size:1.6rem;margin-bottom:8px">$${product.price.toFixed(2)}</div>
      <p style="font-size:0.9rem;line-height:1.7;margin-bottom:20px;color:var(--text-mid)">${product.description}</p>
      <div class="product-reassurance" style="margin-bottom:20px">
        <strong>🐾 Crafted with love.</strong> Your memorial will be made with the utmost care and attention to detail.
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" style="flex:1" onclick="addToCart({id:'${product.id}',name:'${product.name}',price:${product.price},qty:1,image:'${product.image}'});closeModal()">Add to Cart</button>
        <a href="product.html?id=${product.id}" class="btn btn-outline">Full Details</a>
      </div>
    `;
  }
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.querySelector('.modal-close')?.addEventListener('click', closeModal);

window.openQuickView = openQuickView;
window.closeModal    = closeModal;

// ─── Product Gallery Thumbnails ─────────────────
const thumbnails = document.querySelectorAll('.thumbnail');
const mainImg    = document.querySelector('.main-image img');

thumbnails.forEach(thumb => {
  thumb.addEventListener('click', () => {
    thumbnails.forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    if (mainImg) {
      mainImg.style.opacity = '0';
      mainImg.style.transform = 'scale(0.97)';
      setTimeout(() => {
        mainImg.src = thumb.querySelector('img').src;
        mainImg.style.opacity = '1';
        mainImg.style.transform = 'scale(1)';
      }, 200);
    }
  });
});

if (mainImg) {
  mainImg.style.transition = 'opacity 0.25s, transform 0.25s';
}

// ─── Quantity Selector ──────────────────────────
document.querySelectorAll('.qty-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.qty-selector')?.querySelector('.qty-input');
    if (!input) return;
    let val = parseInt(input.value) || 1;
    if (btn.dataset.action === 'minus') val = Math.max(1, val - 1);
    if (btn.dataset.action === 'plus')  val = Math.min(99, val + 1);
    input.value = val;
  });
});

// ─── FAQ Accordion ──────────────────────────────
document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', () => {
    const item   = question.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// ─── Filter Options ─────────────────────────────
document.querySelectorAll('.filter-option').forEach(option => {
  option.addEventListener('click', () => {
    const group = option.closest('.filter-group');
    if (group?.dataset.single) {
      group.querySelectorAll('.filter-option').forEach(o => o.classList.remove('active'));
    }
    option.classList.toggle('active');
    filterProducts();
  });
});

function filterProducts() {
  const count = document.querySelector('.results-count');
  if (count) {
    const activeFilters = document.querySelectorAll('.filter-option.active').length;
    const base = 12;
    count.textContent = `Showing ${activeFilters > 0 ? Math.max(3, base - activeFilters * 2) : base} products`;
  }
}

// ─── Newsletter Form ────────────────────────────
document.querySelectorAll('.newsletter-form').forEach(form => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    if (input?.value) {
      showToast('Thank you for joining our community 🐾', 'success');
      input.value = '';
    }
  });
});

// ─── Contact Form ───────────────────────────────
document.querySelector('.contact-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  showToast("Your message has been sent. We'll be in touch soon 💛", 'success');
  e.target.reset();
});

// ─── Bundle Variant Selector (Product Page) ─────
function selectVariant(btn) {
  document.querySelectorAll('.variant-option').forEach(b => {
    b.classList.remove('selected');
    b.style.background = 'transparent';
    b.style.color = 'var(--warm-text)';
    b.style.borderColor = 'var(--gray-light)';
    const sub = b.querySelector('div:last-child');
    if (sub) sub.style.color = 'var(--text-light)';
  });
  btn.classList.add('selected');
  btn.style.background = 'var(--warm-text)';
  btn.style.color = 'var(--cream)';
  btn.style.borderColor = 'var(--warm-text)';
  const sub = btn.querySelector('div:last-child');
  if (sub) sub.style.color = 'rgba(250,246,240,0.8)';

  const price = btn.dataset.price;
  const priceEl = document.querySelector('.product-price-large');
  if (priceEl) { priceEl.textContent = '$' + parseFloat(price).toFixed(2); priceEl.dataset.price = price; }
  const addBtn = document.querySelector('.add-to-cart-btn');
  if (addBtn) addBtn.textContent = `Add to Cart — $${parseFloat(price).toFixed(2)}`;
}
window.selectVariant = selectVariant;

// ─── Add to Cart (Product Page) ─────────────────
document.querySelector('.add-to-cart-btn')?.addEventListener('click', async function () {
  this.disabled = true;
  const selected = document.querySelector('.variant-option.selected');
  const variantId = selected?.dataset.variantId || 'buy1g1';
  const price     = parseFloat(selected?.dataset.price || '21.00');
  const label     = selected?.querySelector('div')?.textContent || 'Buy 1 Get 1 Free';
  const name      = `Fur Keepsake Capsule — ${label}`;
  const image     = document.querySelector('.main-image img')?.src || '';

  await addToCart({ id: variantId, name, price, qty: 1, image });
  this.disabled = false;
});

// ─── Smooth page load ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.4s ease';
    document.body.style.opacity = '1';
  });
});
