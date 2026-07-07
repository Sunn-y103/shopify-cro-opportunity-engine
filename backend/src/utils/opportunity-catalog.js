/**
 * opportunity-catalog.js
 *
 * Configurable catalog of CRO opportunities.
 * The backend rule engine evaluates these dynamically to decide which opportunities are active.
 */

export const opportunityCatalog = [
  {
    id: 'missing_hero_heading',
    issue: 'Hero Heading Not Detected',
    impact: 4,
    effort: 'Low',
    category: 'Homepage',
    pageType: 'Homepage',
    defaultEvidence: 'No prominent hero banner heading was detected on the homepage during crawl.',
    defaultRecommendation: 'Add a clear, value-driven H1 heading to the homepage hero banner explaining what your brand offers.',
    defaultExpectedLift: '+0.5% to +1.0%',
    testTrigger: (storeData) => {
      const hasHomepage = storeData.homepage && !storeData.errors?.some(e => e.includes('Homepage'));
      return hasHomepage && !storeData.homepage.hero?.heading;
    }
  },
  {
    id: 'missing_hero_cta',
    issue: 'Hero Banner CTA Not Detected',
    impact: 4,
    effort: 'Low',
    category: 'Homepage',
    pageType: 'Homepage',
    defaultEvidence: 'No clickable Call-To-Action (CTA) link or button was detected in the homepage hero section.',
    defaultRecommendation: 'Add a primary CTA button (e.g., "Shop Now") inside the hero section to guide users into key collections.',
    defaultExpectedLift: '+1.0% to +1.5%',
    testTrigger: (storeData) => {
      const hasHomepage = storeData.homepage && !storeData.errors?.some(e => e.includes('Homepage'));
      const hero = storeData.homepage?.hero;
      return hasHomepage && hero && (!hero.cta || !hero.cta.text);
    }
  },
  {
    id: 'missing_newsletter',
    issue: 'Newsletter Signup Not Detected',
    impact: 3,
    effort: 'Low',
    category: 'Homepage',
    pageType: 'Homepage',
    defaultEvidence: 'No email subscription or newsletter signup form was detected on the homepage.',
    defaultRecommendation: 'Place a newsletter signup form in the homepage footer or body, offering a first-purchase discount incentive.',
    defaultExpectedLift: '+0.2% to +0.5%',
    testTrigger: (storeData) => {
      const ns = storeData.homepage?.newsletter;
      return ns?.checked && !ns?.detected;
    }
  },
  {
    id: 'missing_filters',
    issue: 'Collection Filters Not Detected',
    impact: 4,
    effort: 'Medium',
    category: 'Collections',
    pageType: 'Collection Page',
    defaultEvidence: 'No collection page product filtering controls (e.g. by size, color, price) were detected.',
    defaultRecommendation: 'Enable collection filters in your Shopify theme editor to help shoppers locate products quickly.',
    defaultExpectedLift: '+0.8% to +1.5%',
    testTrigger: (storeData) => {
      const cols = storeData.collections || [];
      if (cols.length === 0) return false;
      const anyChecked = cols.some(c => c.filters?.checked);
      const anyDetected = cols.some(c => c.filters?.detected);
      return anyChecked && !anyDetected;
    }
  },
  {
    id: 'missing_sorting',
    issue: 'Collection Sorting Not Detected',
    impact: 3,
    effort: 'Low',
    category: 'Collections',
    pageType: 'Collection Page',
    defaultEvidence: 'No product sorting dropdown (e.g. price low-high, best sellers) was detected on collection pages.',
    defaultRecommendation: 'Enable product sorting controls on all collections to assist users with product discovery.',
    defaultExpectedLift: '+0.3% to +0.8%',
    testTrigger: (storeData) => {
      const cols = storeData.collections || [];
      if (cols.length === 0) return false;
      const anyChecked = cols.some(c => c.sortingOptions?.checked);
      const anyDetected = cols.some(c => c.sortingOptions?.detected);
      return anyChecked && !anyDetected;
    }
  },
  {
    id: 'missing_reviews',
    issue: 'Product Reviews Not Detected',
    impact: 5,
    effort: 'Medium',
    category: 'PDP',
    pageType: 'Product Page',
    defaultEvidence: 'No star ratings or product review widgets were detected on product details pages.',
    defaultRecommendation: 'Install a reviews app and display customer reviews and average star ratings on product pages.',
    defaultExpectedLift: '+1.5% to +2.5%',
    testTrigger: (storeData) => {
      const prds = storeData.products || [];
      if (prds.length === 0) return false;
      const anyChecked = prds.some(p => p.reviews?.checked);
      const anyDetected = prds.some(p => p.reviews?.detected);
      return anyChecked && !anyDetected;
    }
  },
  {
    id: 'missing_sticky_atc',
    issue: 'Sticky Add to Cart Not Detected',
    impact: 4,
    effort: 'Medium',
    category: 'PDP',
    pageType: 'Product Page',
    defaultEvidence: 'No persistent/sticky add-to-cart bar was detected when scrolling down product pages.',
    defaultRecommendation: 'Implement a sticky add-to-cart button that remains visible as the user scrolls past the main buy form.',
    defaultExpectedLift: '+0.5% to +1.2%',
    testTrigger: (storeData) => {
      const prds = storeData.products || [];
      if (prds.length === 0) return false;
      const anyChecked = prds.some(p => p.stickyAddToCart?.checked);
      const anyDetected = prds.some(p => p.stickyAddToCart?.detected);
      return anyChecked && !anyDetected;
    }
  },
  {
    id: 'missing_buy_now',
    issue: 'Express Buy Now Button Not Detected',
    impact: 3,
    effort: 'Low',
    category: 'PDP',
    pageType: 'Product Page',
    defaultEvidence: 'No secondary dynamic checkout or "Buy It Now" direct payment button was detected on PDPs.',
    defaultRecommendation: 'Enable dynamic checkout buttons in your theme settings to allow one-click express purchases.',
    defaultExpectedLift: '+0.5% to +1.0%',
    testTrigger: (storeData) => {
      const prds = storeData.products || [];
      if (prds.length === 0) return false;
      return prds.every(p => !p.buyNow);
    }
  },
  {
    id: 'missing_shipping_info',
    issue: 'Product Shipping Info Not Detected',
    impact: 3,
    effort: 'Low',
    category: 'PDP',
    pageType: 'Product Page',
    defaultEvidence: 'No clear delivery times, shipping costs, or free shipping threshold information was found on product pages.',
    defaultRecommendation: 'Add a concise shipping info block near the Add to Cart button specifying delivery timelines.',
    defaultExpectedLift: '+0.4% to +0.8%',
    testTrigger: (storeData) => {
      const prds = storeData.products || [];
      if (prds.length === 0) return false;
      const anyChecked = prds.some(p => p.shippingInfo?.checked);
      const anyDetected = prds.some(p => p.shippingInfo?.detected);
      return anyChecked && !anyDetected;
    }
  },
  {
    id: 'missing_return_policy',
    issue: 'Product Return Policy Not Detected',
    impact: 3,
    effort: 'Low',
    category: 'PDP',
    pageType: 'Product Page',
    defaultEvidence: 'No reference to return window policies or money-back guarantees was detected on product pages.',
    defaultRecommendation: 'Display your return window policy (e.g. "Hassle-Free 30-Day Returns") prominently near the add-to-cart form.',
    defaultExpectedLift: '+0.3% to +0.7%',
    testTrigger: (storeData) => {
      const prds = storeData.products || [];
      if (prds.length === 0) return false;
      const anyChecked = prds.some(p => p.returnPolicy?.checked);
      const anyDetected = prds.some(p => p.returnPolicy?.detected);
      return anyChecked && !anyDetected;
    }
  },
  {
    id: 'missing_coupon',
    issue: 'Cart Coupon Code Field Not Detected',
    impact: 3,
    effort: 'Low',
    category: 'Cart',
    pageType: 'Cart Page',
    defaultEvidence: 'No promo code or discount entry field was detected directly within the cart drawer or cart page.',
    defaultRecommendation: 'Add a discount code input field to the cart page so users do not have to wait until checkout to enter it.',
    defaultExpectedLift: '+0.2% to +0.5%',
    testTrigger: (storeData) => {
      const coupon = storeData.cart?.couponField;
      return coupon?.checked && !coupon?.detected;
    }
  },
  {
    id: 'missing_shipping_estimator',
    issue: 'Cart Shipping Estimator Not Detected',
    impact: 3,
    effort: 'Medium',
    category: 'Cart',
    pageType: 'Cart Page',
    defaultEvidence: 'No shipping cost calculator or shipping estimator widget was found inside the cart.',
    defaultRecommendation: 'Implement a shipping calculator in the cart to reduce checkout abandonment caused by unexpected shipping fees.',
    defaultExpectedLift: '+0.3% to +0.8%',
    testTrigger: (storeData) => {
      const est = storeData.cart?.shippingEstimator;
      return est?.checked && !est?.detected;
    }
  },
  {
    id: 'missing_free_shipping_banner',
    issue: 'Free Shipping Progress Bar Not Detected',
    impact: 4,
    effort: 'Medium',
    category: 'Cart',
    pageType: 'Cart Page',
    defaultEvidence: 'No visual progress indicator displaying how much more is needed for free shipping was detected in the cart.',
    defaultRecommendation: 'Add a dynamic free shipping progress bar to the cart to incentivize adding higher value items.',
    defaultExpectedLift: '+1.0% to +2.0%',
    testTrigger: (storeData) => {
      const fs = storeData.cart?.freeShippingBanner;
      return fs?.checked && !fs?.detected;
    }
  },
  {
    id: 'missing_upsells',
    issue: 'Cart Upsell Recommendations Not Detected',
    impact: 4,
    effort: 'Medium',
    category: 'Cart',
    pageType: 'Cart Page',
    defaultEvidence: 'No product upsell or cross-sell recommendations were detected in the cart.',
    defaultRecommendation: 'Display contextual product recommendations (like add-on accessories) directly inside the cart drawer.',
    defaultExpectedLift: '+1.2% to +2.2%',
    testTrigger: (storeData) => {
      const ups = storeData.cart?.upsells;
      const cross = storeData.cart?.crossSells;
      return (ups?.checked || cross?.checked) && !ups?.detected && !cross?.detected;
    }
  },
  {
    id: 'missing_trust_badges',
    issue: 'Trust Badges Not Detected',
    impact: 4,
    effort: 'Low',
    category: 'Trust',
    pageType: 'Global',
    defaultEvidence: 'No trust badges (e.g. security seals, satisfaction guarantee icons) were detected across the store.',
    defaultRecommendation: 'Add visual trust badges (such as security seals or guarantee symbols) in the footer and on cart pages.',
    defaultExpectedLift: '+0.5% to +1.2%',
    testTrigger: (storeData) => {
      const hpTrust = storeData.homepage?.trustBadges;
      const cartTrust = storeData.cart?.trustBadges;
      const prds = storeData.products || [];
      const checked = hpTrust?.checked || cartTrust?.checked || prds.some(p => p.trustBadges?.checked);
      const detected = hpTrust?.detected || cartTrust?.detected || prds.some(p => p.trustBadges?.detected);
      return checked && !detected;
    }
  },
  {
    id: 'missing_payment_icons',
    issue: 'Payment Method Icons Not Detected',
    impact: 3,
    effort: 'Low',
    category: 'Trust',
    pageType: 'Global',
    defaultEvidence: 'No accepted payment method icons (Visa, Mastercard, Paypal, Shop Pay) were detected in the footer or cart.',
    defaultRecommendation: 'Show recognized payment icon badges in the footer to reassure buyers that their payment methods are accepted.',
    defaultExpectedLift: '+0.3% to +0.8%',
    testTrigger: (storeData) => {
      const cartPay = storeData.cart?.paymentMethods;
      const prds = storeData.products || [];
      const checked = cartPay?.checked || prds.some(p => p.paymentIcons?.checked);
      const detected = cartPay?.detected || prds.some(p => p.paymentIcons?.detected);
      return checked && !detected;
    }
  }
];
