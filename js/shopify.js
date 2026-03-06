/* =============================================
   EverPaws — Shopify Storefront API
   =============================================

   SETUP INSTRUCTIONS
   ──────────────────
   1. Create a Shopify store at shopify.com
   2. Go to: Settings → Apps and sales channels → Develop apps
   3. Create an app, enable Storefront API, grant:
        - unauthenticated_read_product_listings
        - unauthenticated_write_checkouts
        - unauthenticated_read_checkouts
   4. Copy your Storefront API access token below
   5. Add your products in Shopify, then paste each
      variant's GID into VARIANT_MAP below
      (find it: Products → [product] → share → copy link,
       the number at the end is the variant ID)
   ============================================= */

'use strict';

// ── Your store credentials ───────────────────────────────────────
const SHOPIFY_DOMAIN        = 'everpaws.company';
const STOREFRONT_TOKEN      = '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';
const STOREFRONT_API_VERSION = '2024-01';

// ── Product variant map ──────────────────────────────────────────
// Keys match the product IDs used in your HTML (openQuickView calls)
// Values are Shopify variant GIDs — format: gid://shopify/ProductVariant/1234567890
// Leave as REPLACE_ME until you have real IDs — the cart will show a
// "Shopify not configured" notice instead of erroring out.
window.VARIANT_MAP = {
  // Buy 1 Get 1 Free — $21.00 (2 capsules)
  'buy1g1': 'gid://shopify/ProductVariant/REPLACE_ME',
  // Buy 2 Get 2 Free — $39.99 (4 capsules)
  'buy2g2': 'gid://shopify/ProductVariant/REPLACE_ME',
};

// ── Internal helpers ─────────────────────────────────────────────
const CART_ID_KEY = 'everpaws_cart_id';

async function storefrontFetch(query, variables = {}) {
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/api/${STOREFRONT_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`Storefront API error ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// Reusable cart fields — keeps all queries in sync
const CART_FIELDS = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      totalAmount { amount currencyCode }
    }
    lines(first: 50) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              product {
                title
                featuredImage { url }
              }
            }
          }
        }
      }
    }
  }
`;

// ── ShopifyCart public API ───────────────────────────────────────
window.ShopifyCart = (() => {
  let _cart = null;

  function _notify() {
    window.dispatchEvent(new CustomEvent('cart:updated'));
  }

  function _setCart(cart) {
    _cart = cart;
    _notify();
  }

  async function _fetchCart(cartId) {
    const data = await storefrontFetch(`
      query GetCart($id: ID!) { cart(id: $id) { ...CartFields } }
      ${CART_FIELDS}
    `, { id: cartId });
    return data.cart;
  }

  async function _createCart(variantId, quantity) {
    const data = await storefrontFetch(`
      mutation CartCreate($lines: [CartLineInput!]) {
        cartCreate(input: { lines: $lines }) {
          cart { ...CartFields }
          userErrors { field message }
        }
      }
      ${CART_FIELDS}
    `, { lines: [{ merchandiseId: variantId, quantity }] });
    if (data.cartCreate.userErrors.length) {
      throw new Error(data.cartCreate.userErrors[0].message);
    }
    return data.cartCreate.cart;
  }

  async function _addLines(cartId, variantId, quantity) {
    const data = await storefrontFetch(`
      mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart { ...CartFields }
          userErrors { field message }
        }
      }
      ${CART_FIELDS}
    `, { cartId, lines: [{ merchandiseId: variantId, quantity }] });
    if (data.cartLinesAdd.userErrors.length) {
      throw new Error(data.cartLinesAdd.userErrors[0].message);
    }
    return data.cartLinesAdd.cart;
  }

  async function _removeLines(cartId, lineIds) {
    const data = await storefrontFetch(`
      mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { ...CartFields }
          userErrors { field message }
        }
      }
      ${CART_FIELDS}
    `, { cartId, lineIds });
    if (data.cartLinesRemove.userErrors.length) {
      throw new Error(data.cartLinesRemove.userErrors[0].message);
    }
    return data.cartLinesRemove.cart;
  }

  return {
    // Call once on page load to restore a saved cart
    async init() {
      const cartId = localStorage.getItem(CART_ID_KEY);
      if (!cartId) return;
      try {
        const cart = await _fetchCart(cartId);
        if (cart) {
          _setCart(cart);
        } else {
          // Cart expired in Shopify
          localStorage.removeItem(CART_ID_KEY);
        }
      } catch {
        localStorage.removeItem(CART_ID_KEY);
      }
    },

    // Add a variant to the cart (creates cart if none exists)
    async addItem(variantId, quantity = 1) {
      const cartId = localStorage.getItem(CART_ID_KEY);
      let cart;
      if (cartId) {
        cart = await _addLines(cartId, variantId, quantity);
      } else {
        cart = await _createCart(variantId, quantity);
        localStorage.setItem(CART_ID_KEY, cart.id);
      }
      _setCart(cart);
    },

    // Remove a line by its Shopify line ID
    async removeItem(lineId) {
      const cartId = localStorage.getItem(CART_ID_KEY);
      if (!cartId) return;
      const cart = await _removeLines(cartId, [lineId]);
      _setCart(cart);
    },

    getLines()       { return _cart ? _cart.lines.edges.map(e => e.node) : []; },
    getTotalCount()  { return _cart?.totalQuantity || 0; },
    getCheckoutUrl() { return _cart?.checkoutUrl || '#'; },
    getTotal() {
      if (!_cart) return '$0.00';
      const { amount, currencyCode } = _cart.cost.totalAmount;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    },
  };
})();
