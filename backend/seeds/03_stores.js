/**
 * Seed pour créer des boutiques de test
 */
exports.seed = async function(knex) {
    // Supprimer les données existantes
    await knex('stores').del();
  
    // Récupérer les IDs des vendeurs
    const vendors = await knex('users')
      .select('id', 'first_name', 'last_name', 'email')
      .where('role', 'vendor');
  
    if (vendors.length < 3) {
      console.error('❌ Pas assez de vendeurs trouvés. Exécutez d\'abord le seed users.');
      return;
    }
  
    // Insérer les boutiques de test
    await knex('stores').insert([
      // Boutique 1 - AfrikStyle by Fatou
      {
        id: '00000000-1111-1111-1111-111111111111',
        name: 'AfrikStyle by Fatou',
        slug: 'afrikstyle-fatou',
        description: 'Boutique spécialisée dans la création de vêtements africains modernes. Fatou mélange tradition et tendances contemporaines pour créer des pièces uniques qui célèbrent la beauté de la mode africaine.',
        short_description: 'Mode africaine moderne et élégante par une créatrice passionnée',
        owner_id: vendors[0].id, // Fatou Bamba
        logo_url: '/uploads/stores/afrikstyle-logo.jpg',
        banner_url: '/uploads/stores/afrikstyle-banner.jpg',
        theme_color: '#8B2E2E',
        brand_colors: JSON.stringify({
          primary: '#8B2E2E',
          secondary: '#D9744F',
          accent: '#6B8E23',
          background: '#FFF9F6'
        }),
        email: 'fatou@afrikstyle.tg',
        phone: '+228 90 12 34 56',
        whatsapp: '+228 90 12 34 56',
        website: 'https://afrikstyle.tg',
        social_links: JSON.stringify({
          facebook: 'https://facebook.com/afrikstyle.fatou',
          instagram: 'https://instagram.com/afrikstyle_fatou',
          tiktok: 'https://tiktok.com/@afrikstyle_fatou'
        }),
        country: 'TG',
        region: 'Maritime',
        city: 'Lomé',
        address: 'Marché des Féticheurs, Hedzranawoé, Lomé',
        postal_code: '01BP234',
        latitude: 6.1319,
        longitude: 1.2228,
        business_registration_number: 'TG-2021-AFR-001',
        tax_number: 'TG-TAX-AFR-001',
        business_type: 'individual',
        status: 'active',
        is_verified: true,
        featured: true,
        commission_rate: 8.5,
        return_policy: 'Retours acceptés sous 14 jours en parfait état avec étiquettes.',
        shipping_policy: 'Livraison gratuite à Lomé. Frais de port calculés selon la destination.',
        default_language: 'fr',
        supported_languages: JSON.stringify(['fr', 'en']),
        default_currency: 'FCFA',
        accepted_currencies: JSON.stringify(['FCFA', 'EUR', 'USD']),
        payment_methods: JSON.stringify(['tmoney', 'flooz', 'orange_money', 'cash_on_delivery']),
        total_orders: 89,
        total_revenue: 2450000,
        average_rating: 4.7,
        total_reviews: 42,
        total_products: 0, // Sera mis à jour par les produits
        followers_count: 156,
        meta_title: 'AfrikStyle by Fatou - Mode Africaine Moderne',
        meta_description: 'Découvrez les créations uniques de Fatou: robes en wax, ensembles traditionnels revisités et mode africaine contemporaine.',
        meta_keywords: JSON.stringify(['mode africaine', 'créatrice', 'wax', 'robes traditionnelles', 'Fatou Bamba']),
        opening_hours: JSON.stringify({
          monday: { open: '08:00', close: '18:00' },
          tuesday: { open: '08:00', close: '18:00' },
          wednesday: { open: '08:00', close: '18:00' },
          thursday: { open: '08:00', close: '18:00' },
          friday: { open: '08:00', close: '18:00' },
          saturday: { open: '08:00', close: '16:00' },
          sunday: { open: '10:00', close: '14:00' }
        }),
        timezone: 'Africa/Lome',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      // Boutique 2 - Tissages Traditionnels Koffi
      {
        id: '00000000-2222-2222-2222-222222222222',
        name: 'Tissages Traditionnels Koffi',
        slug: 'tissages-koffi',
        description: 'Artisan tisseur spécialisé dans la création de textiles traditionnels authentiques. Koffi perpétue l\'art ancestral du tissage avec des techniques transmises de génération en génération.',
        short_description: 'Textiles authentiques tissés à la main par un maître artisan',
        owner_id: vendors[1].id, // Koffi Mensah
        logo_url: '/uploads/stores/tissages-koffi-logo.jpg',
        banner_url: '/uploads/stores/tissages-koffi-banner.jpg',
        theme_color: '#6B4423',
        brand_colors: JSON.stringify({
          primary: '#6B4423',
          secondary: '#8B6914',
          accent: '#D4AF37',
          background: '#FFF8DC'
        }),
        email: 'koffi@bogolan.tg',
        phone: '+228 90 23 45 67',
        whatsapp: '+228 90 23 45 67',
        social_links: JSON.stringify({
          facebook: 'https://facebook.com/tissages.koffi',
          instagram: 'https://instagram.com/tissages_koffi_authentic'
        }),
        country: 'TG',
        region: 'Plateaux',
        city: 'Kpalimé',
        address: 'Centre Artisanal, Kpalimé',
        postal_code: '02BP567',
        latitude: 6.9000,
        longitude: 0.6333,
        business_registration_number: 'TG-2020-TIS-002',
        tax_number: 'TG-TAX-TIS-002',
        business_type: 'individual',
        status: 'active',
        is_verified: true,
        featured: true,
        commission_rate: 7.0,
        return_policy: 'Articles sur mesure non échangeables. Défauts de fabrication remboursés.',
        shipping_policy: 'Livraison par transporteur. Délai variable selon création.',
        default_language: 'fr',
        supported_languages: JSON.stringify(['fr']),
        default_currency: 'FCFA',
        accepted_currencies: JSON.stringify(['FCFA', 'EUR']),
        payment_methods: JSON.stringify(['mtn_money', 'cash_on_delivery', 'bank_transfer']),
        total_orders: 67,
        total_revenue: 1890000,
        average_rating: 4.9,
        total_reviews: 28,
        total_products: 0,
        followers_count: 89,
        meta_title: 'Tissages Traditionnels Koffi - Artisan Maître Tisseur',
        meta_description: 'Découvrez l\'art authentique du tissage traditionnel avec Koffi Mensah, maître artisan de Kpalimé.',
        meta_keywords: JSON.stringify(['tissage traditionnel', 'kente', 'bogolan', 'artisan', 'Kpalimé']),
        opening_hours: JSON.stringify({
          monday: { open: '07:00', close: '17:00' },
          tuesday: { open: '07:00', close: '17:00' },
          wednesday: { open: '07:00', close: '17:00' },
          thursday: { open: '07:00', close: '17:00' },
          friday: { open: '07:00', close: '17:00' },
          saturday: { open: '07:00', close: '15:00' },
          sunday: 'closed'
        }),
        timezone: 'Africa/Lome',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      // Boutique 3 - Élégance Togo
      {
        id: '00000000-3333-3333-3333-333333333333',
        name: 'Élégance Togo',
        slug: 'elegance-togo',
        description: 'Maison de couture spécialisée dans la mode africaine contemporaine haut de gamme. Aïsha crée des pièces sophistiquées qui allient modernité et héritage culturel africain.',
        short_description: 'Mode africaine contemporaine et sophistiquée',
        owner_id: vendors[2].id, // Aïsha Diallo
        logo_url: '/uploads/stores/elegance-togo-logo.jpg',
        banner_url: '/uploads/stores/elegance-togo-banner.jpg',
        theme_color: '#2F1B69',
        brand_colors: JSON.stringify({
          primary: '#2F1B69',
          secondary: '#8B2E8B',
          accent: '#FFD700',
          background: '#F8F5FF'
        }),
        email: 'aisha@elegancetogo.com',
        phone: '+228 90 34 56 78',
        whatsapp: '+228 90 34 56 78',
        website: 'https://elegancetogo.com',
        social_links: JSON.stringify({
          facebook: 'https://facebook.com/elegance.togo',
          instagram: 'https://instagram.com/elegance_togo_official',
          pinterest: 'https://pinterest.com/elegancetogo',
          youtube: 'https://youtube.com/c/EleganceTogo'
        }),
        country: 'TG',
        region: 'Maritime',
        city: 'Lomé',
        address: 'Avenue de la Paix, Bè, Lomé',
        postal_code: '01BP789',
        latitude: 6.1375,
        longitude: 1.2123,
        business_registration_number: 'TG-2022-ELE-003',
        tax_number: 'TG-TAX-ELE-003',
        business_type: 'company',
        status: 'active',
        is_verified: true,
        featured: true,
        commission_rate: 9.0,
        return_policy: 'Retours sous 21 jours. Articles sur mesure non remboursables sauf défaut.',
        shipping_policy: 'Livraison express disponible. International shipping available.',
        privacy_policy: 'Vos données sont protégées selon notre politique de confidentialité.',
        terms_conditions: 'Conditions générales disponibles sur notre site web.',
        default_language: 'fr',
        supported_languages: JSON.stringify(['fr', 'en']),
        default_currency: 'FCFA',
        accepted_currencies: JSON.stringify(['FCFA', 'EUR', 'USD']),
        payment_methods: JSON.stringify(['tmoney', 'flooz', 'orange_money', 'paypal', 'cash_on_delivery']),
        total_orders: 134,
        total_revenue: 3720000,
        average_rating: 4.8,
        total_reviews: 67,
        total_products: 0,
        followers_count: 234,
        meta_title: 'Élégance Togo - Haute Couture Africaine Contemporaine',
        meta_description: 'Maison de couture spécialisée dans la mode africaine haut de gamme. Créations sophistiquées par Aïsha Diallo.',
        meta_keywords: JSON.stringify(['haute couture', 'mode contemporaine', 'élégance', 'Aïsha Diallo', 'Lomé']),
        opening_hours: JSON.stringify({
          monday: { open: '09:00', close: '19:00' },
          tuesday: { open: '09:00', close: '19:00' },
          wednesday: { open: '09:00', close: '19:00' },
          thursday: { open: '09:00', close: '19:00' },
          friday: { open: '09:00', close: '19:00' },
          saturday: { open: '10:00', close: '18:00' },
          sunday: { open: '14:00', close: '17:00' }
        }),
        timezone: 'Africa/Lome',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      // Boutique 4 - Boutique de démonstration (inactive)
      {
        id: '00000000-4444-4444-4444-444444444444',
        name: 'Atelier Demo',
        slug: 'atelier-demo',
        description: 'Boutique de démonstration pour les tests et la formation.',
        short_description: 'Boutique de test et démonstration',
        owner_id: vendors[0].id, // Réutiliser le premier vendeur
        logo_url: '/uploads/stores/demo-logo.jpg',
        banner_url: '/uploads/stores/demo-banner.jpg',
        theme_color: '#808080',
        email: 'demo@afrikmode.com',
        phone: '+228 90 00 00 00',
        country: 'TG',
        city: 'Lomé',
        address: 'Adresse de test',
        status: 'pending',
        is_verified: false,
        featured: false,
        commission_rate: 10.0,
        default_language: 'fr',
        default_currency: 'FCFA',
        total_orders: 0,
        total_revenue: 0,
        average_rating: 0,
        total_reviews: 0,
        total_products: 0,
        followers_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);
  
    console.log('✅ Boutiques de test créées avec succès');
    console.log('🏪 Boutiques actives: AfrikStyle, Tissages Koffi, Élégance Togo');
    console.log('📍 Localisations: Lomé (2), Kpalimé (1)');
  };