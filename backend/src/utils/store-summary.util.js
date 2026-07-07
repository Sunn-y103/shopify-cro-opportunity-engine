export function buildStoreSummary(store) {
  const hp = store.homepage || {};
  const cols = store.collections || [];
  const prds = store.products || [];
  const cart = store.cart || {};

  const filterLabels = [];
  for (const col of cols) {
    for (const f of (col.filters?.labels ?? col.filters ?? [])) {
      if (filterLabels.length < 5 && !filterLabels.includes(f)) filterLabels.push(f);
    }
  }

  const sortOptions = [];
  for (const col of cols) {
    for (const s of (col.sortingOptions?.options ?? col.sortingOptions ?? [])) {
      if (sortOptions.length < 5 && !sortOptions.includes(s)) sortOptions.push(s);
    }
  }

  return {
    Homepage: {
      heroHeading: !!hp.hero?.heading,
      heroCta: !!hp.hero?.cta?.text,
      announcementBar: !!hp.announcementBar,
      newsletter: hp.newsletter?.detected ?? hp.newsletter?.exists ?? false,
      trustBadges: hp.trustBadges?.badges?.length ?? hp.trustBadges?.length ?? 0,
      navigationSize: hp.navigation?.length ?? 0,
      featuredCollections: hp.featuredCollections?.length ?? 0,
      socialLinks: Object.keys(hp.socialLinks || {}).length
    },
    Collections: {
      count: cols.length,
      filtersDetected: cols.some(c => c.filters?.detected),
      filterLabelsCount: filterLabels.length,
      sortingDetected: cols.some(c => c.sortingOptions?.detected),
      sortingOptionsCount: sortOptions.length
    },
    Products: {
      analyzedCount: prds.length,
      reviewsDetected: prds.some(p => p.reviews?.detected ?? p.reviews?.hasReviews),
      ratingsDetected: prds.some(p => p.reviews?.rating),
      shippingInfoDetected: prds.some(p => p.shippingInfo?.detected),
      returnPolicyDetected: prds.some(p => p.returnPolicy?.detected),
      stickyAtcDetected: prds.some(p => p.stickyAddToCart?.detected),
      buyNowDetected: prds.some(p => p.buyNow?.detected ?? p.buyNow),
      trustBadgesDetected: prds.some(p => p.trustBadges?.detected),
      paymentIconsDetected: prds.some(p => p.paymentIcons?.detected)
    },
    Cart: {
      type: cart.cartType,
      couponDetected: cart.couponField?.detected ?? false,
      freeShippingBanner: cart.freeShippingBanner?.detected ?? false,
      expressCheckout: cart.expressCheckout?.detected ?? false,
      upsellsDetected: cart.upsells?.detected ?? false,
      crossSellsDetected: cart.crossSells?.detected ?? false,
      trustBadgesDetected: cart.trustBadges?.detected ?? false
    },
    Trust: {
      reviewsDetected: prds.some(p => p.reviews?.detected ?? p.reviews?.hasReviews),
      ratingsDetected: prds.some(p => p.reviews?.rating),
      socialProofLinks: Object.keys(hp.socialLinks || {}).length > 0
    }
  };
}
