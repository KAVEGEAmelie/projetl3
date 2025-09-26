/**
 * Seed pour créer des produits de test
 */
exports.seed = async function(knex) {
    // Supprimer les données existantes
    await knex('products').del();
  
    // Récupérer les IDs des boutiques et catégories
    const stores = await knex('stores').select('id', 'name').whereNull('deleted_at');
    const categories = await knex('categories').select('id', 'name', 'slug').whereNull('deleted_at');
  
    if (stores.length < 3 || categories.length < 5) {
      console.error('❌ Pas assez de boutiques ou catégories. Exécutez d\'abord les autres seeds.');
      return;
    }
  
    // Fonction helper pour sélectionner un élément aléatoire
    const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];
    
    // Fonction helper pour générer un prix aléatoire
    const randomPrice = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  
    // Trouver les catégories spécifiques
    const robeCat = categories.find(c => c.slug === 'robes') || categories[0];
    const boubouCat = categories.find(c => c.slug === 'boubous-caftans') || categories[1];
    const dashikiCat = categories.find(c => c.slug === 'dashiki') || categories[2];
    const bijouCat = categories.find(c => c.slug === 'bijoux') || categories[3];
    const tisseCat = categories.find(c => c.slug === 'tissus-wax') || categories[4];
  
    // Boutiques
    const afrikStyle = stores[0]; // AfrikStyle by Fatou
    const tissagesKoffi = stores[1]; // Tissages Traditionnels Koffi
    const eleganceTogo = stores[2]; // Élégance Togo
  
    // Produits de démonstration
    const products = [
      // Produits AfrikStyle by Fatou
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Robe Wax Élégante "Akwaba"',
        slug: 'robe-wax-elegante-akwaba',
        description: 'Magnifique robe en tissu wax authentique, parfaite pour les occasions spéciales. Coupe moderne qui met en valeur la silhouette féminine tout en conservant l\'élégance traditionnelle africaine.',
        short_description: 'Robe wax moderne et élégante pour occasions spéciales',
        sku: 'AFR-ROB-001',
        store_id: afrikStyle.id,
        category_id: robeCat.id,
        price: randomPrice(35000, 55000),
        compare_at_price: randomPrice(60000, 75000),
        currency: 'FCFA',
        fabric_type: 'Wax',
        fabric_origin: 'Ghana',
        cultural_significance: JSON.stringify({
          fr: 'Le motif "Akwaba" signifie "Bienvenue" en Akan et symbolise l\'hospitalité',
          en: 'The "Akwaba" pattern means "Welcome" in Akan and symbolizes hospitality'
        }),
        care_instructions: 'Lavage à la main à l\'eau froide, séchage à l\'ombre',
        dimensions: JSON.stringify({ length: 120, width: 60 }),
        weight: 350,
        colors_available: JSON.stringify(['Rouge', 'Bleu', 'Vert', 'Orange']),
        sizes_available: JSON.stringify(['S', 'M', 'L', 'XL']),
        materials: JSON.stringify(['100% Coton Wax']),
        stock_quantity: randomPrice(15, 45),
        low_stock_threshold: 5,
        track_inventory: true,
        allow_backorders: false,
        status: 'active',
        featured: true,
        customizable: true,
        requires_shipping: true,
        shipping_weight: 400,
        fragile: false,
        meta_title: 'Robe Wax Élégante Akwaba - Mode Africaine',
        meta_description: 'Découvrez notre magnifique robe en wax authentique, parfaite pour vos occasions spéciales.',
        artisan_name: 'Fatou Bamba',
        artisan_story: 'Créatrice passionnée formée à l\'école de mode de Lomé',
        artisan_location: 'Lomé, Togo',
        attributes: JSON.stringify({
          style: 'Moderne',
          occasion: 'Soirée',
          saison: 'Toute saison'
        }),
        seasons: JSON.stringify(['printemps', 'été', 'automne', 'hiver']),
        occasions: JSON.stringify(['mariage', 'soirée', 'cérémonie', 'festival']),
        tags: JSON.stringify(['wax', 'robe', 'élégant', 'ghana', 'akwaba']),
        images: JSON.stringify([
          '/uploads/products/robe-akwaba-1.jpg',
          '/uploads/products/robe-akwaba-2.jpg',
          '/uploads/products/robe-akwaba-3.jpg'
        ]),
        primary_image: '/uploads/products/robe-akwaba-1.jpg',
        average_rating: 4.8,
        reviews_count: randomPrice(12, 25),
        sales_count: randomPrice(8, 20),
        views_count: randomPrice(150, 300),
        wishlist_count: randomPrice(20, 45),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Ensemble Complet "Sankofa"',
        slug: 'ensemble-complet-sankofa',
        description: 'Ensemble 2 pièces composé d\'un haut et d\'une jupe assortie en tissu wax premium. Le motif Sankofa rappelle l\'importance de se souvenir de ses racines tout en avançant vers l\'avenir.',
        short_description: 'Ensemble 2 pièces en wax premium avec motif Sankofa',
        sku: 'AFR-ENS-002',
        store_id: afrikStyle.id,
        category_id: robeCat.id,
        price: randomPrice(45000, 65000),
        compare_at_price: randomPrice(70000, 85000),
        currency: 'FCFA',
        fabric_type: 'Wax Premium',
        fabric_origin: 'Côte d\'Ivoire',
        cultural_significance: JSON.stringify({
          fr: 'Sankofa enseigne qu\'il n\'est pas mal de revenir en arrière pour récupérer ce qui a été oublié',
          en: 'Sankofa teaches that it is not wrong to go back and retrieve what was forgotten'
        }),
        care_instructions: 'Lavage délicat, repassage à température moyenne',
        colors_available: JSON.stringify(['Bleu royal', 'Bordeaux', 'Vert émeraude']),
        sizes_available: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
        materials: JSON.stringify(['100% Coton Wax Premium']),
        stock_quantity: randomPrice(12, 30),
        status: 'active',
        featured: true,
        customizable: true,
        artisan_name: 'Fatou Bamba',
        occasions: JSON.stringify(['bureau', 'église', 'cérémonie']),
        tags: JSON.stringify(['ensemble', 'sankofa', 'premium', 'côte d\'ivoire']),
        images: JSON.stringify([
          '/uploads/products/ensemble-sankofa-1.jpg',
          '/uploads/products/ensemble-sankofa-2.jpg'
        ]),
        primary_image: '/uploads/products/ensemble-sankofa-1.jpg',
        average_rating: 4.6,
        reviews_count: randomPrice(8, 18),
        sales_count: randomPrice(5, 15),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      // Produits Élégance Togo
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Caftan de Soirée "Royalty"',
        slug: 'caftan-soiree-royalty',
        description: 'Caftan luxueux en tissu brodé à la main, inspiré des tenues royales africaines. Parfait pour les grandes occasions et les événements prestigieux.',
        short_description: 'Caftan luxueux brodé main pour grandes occasions',
        sku: 'ELE-CAF-001',
        store_id: eleganceTogo.id,
        category_id: boubouCat.id,
        price: randomPrice(85000, 120000),
        compare_at_price: randomPrice(130000, 160000),
        currency: 'FCFA',
        fabric_type: 'Broderie sur Bazin',
        fabric_origin: 'Mali',
        cultural_significance: JSON.stringify({
          fr: 'Inspiré des tenues portées par la royauté africaine traditionnelle',
          en: 'Inspired by traditional African royal attire'
        }),
        care_instructions: 'Nettoyage à sec uniquement, manipulation délicate',
        colors_available: JSON.stringify(['Or et Noir', 'Bleu et Argent', 'Bordeaux et Or']),
        sizes_available: JSON.stringify(['M', 'L', 'XL', 'XXL']),
        materials: JSON.stringify(['Bazin Riche', 'Fil doré', 'Broderie à la main']),
        stock_quantity: randomPrice(5, 15),
        status: 'active',
        featured: true,
        customizable: true,
        artisan_name: 'Aïsha Diallo',
        artisan_story: 'Maître brodeuse formée aux techniques traditionnelles maliennes',
        occasions: JSON.stringify(['mariage', 'gala', 'réception officielle']),
        tags: JSON.stringify(['caftan', 'luxe', 'broderie', 'royauté', 'mali']),
        images: JSON.stringify([
          '/uploads/products/caftan-royalty-1.jpg',
          '/uploads/products/caftan-royalty-2.jpg',
          '/uploads/products/caftan-royalty-3.jpg'
        ]),
        primary_image: '/uploads/products/caftan-royalty-1.jpg',
        average_rating: 4.9,
        reviews_count: randomPrice(15, 30),
        sales_count: randomPrice(3, 10),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Dashiki Moderne "Ubuntu"',
        slug: 'dashiki-moderne-ubuntu',
        description: 'Dashiki revisité dans un style contemporain, alliant tradition et modernité. Le motif Ubuntu célèbre la philosophie africaine de l\'interconnexion humaine.',
        short_description: 'Dashiki contemporain avec motif Ubuntu traditionnel',
        sku: 'ELE-DAS-002',
        store_id: eleganceTogo.id,
        category_id: dashikiCat.id,
        price: randomPrice(25000, 40000),
        currency: 'FCFA',
        fabric_type: 'Coton imprimé',
        fabric_origin: 'Sénégal',
        cultural_significance: JSON.stringify({
          fr: 'Ubuntu : "Je suis parce que nous sommes" - philosophie africaine de l\'humanité partagée',
          en: 'Ubuntu: "I am because we are" - African philosophy of shared humanity'
        }),
        colors_available: JSON.stringify(['Multicolore traditionnel', 'Bleu et blanc', 'Rouge et noir']),
        sizes_available: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
        materials: JSON.stringify(['100% Coton']),
        stock_quantity: randomPrice(20, 40),
        status: 'active',
        featured: false,
        customizable: false,
        artisan_name: 'Aïsha Diallo',
        occasions: JSON.stringify(['décontracté', 'festival', 'weekend']),
        tags: JSON.stringify(['dashiki', 'ubuntu', 'moderne', 'sénégal']),
        images: JSON.stringify([
          '/uploads/products/dashiki-ubuntu-1.jpg',
          '/uploads/products/dashiki-ubuntu-2.jpg'
        ]),
        primary_image: '/uploads/products/dashiki-ubuntu-1.jpg',
        average_rating: 4.4,
        reviews_count: randomPrice(20, 35),
        sales_count: randomPrice(15, 30),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      // Produits Tissages Traditionnels Koffi
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Tissu Kente Authentique',
        slug: 'tissu-kente-authentique',
        description: 'Tissu Kente tissé à la main selon les méthodes traditionnelles ghanéennes. Chaque bande raconte une histoire et porte une signification culturelle profonde.',
        short_description: 'Kente authentique tissé à la main - tradition ghanéenne',
        sku: 'TIS-KEN-001',
        store_id: tissagesKoffi.id,
        category_id: tisseCat.id,
        price: randomPrice(15000, 25000),
        currency: 'FCFA',
        fabric_type: 'Kente',
        fabric_origin: 'Ghana',
        cultural_significance: JSON.stringify({
          fr: 'Tissu royal Akan, chaque motif et couleur a une signification spirituelle et sociale',
          en: 'Royal Akan cloth, each pattern and color has spiritual and social significance'
        }),
        care_instructions: 'Lavage à la main uniquement, séchage à plat',
        dimensions: JSON.stringify({ length: 200, width: 15 }),
        weight: 250,
        colors_available: JSON.stringify(['Traditionnels multiples']),
        materials: JSON.stringify(['Soie', 'Coton', 'Rayonne']),
        stock_quantity: randomPrice(8, 20),
        status: 'active',
        featured: true,
        customizable: false,
        requires_shipping: true,
        artisan_name: 'Koffi Mensah',
        artisan_story: 'Maître tisseur traditionnel, héritier de 4 générations de tisserands',
        artisan_location: 'Kpalimé, Togo',
        occasions: JSON.stringify(['cérémonie', 'mariage', 'graduation']),
        tags: JSON.stringify(['kente', 'tissage', 'ghana', 'traditionnel', 'royal']),
        images: JSON.stringify([
          '/uploads/products/kente-1.jpg',
          '/uploads/products/kente-2.jpg',
          '/uploads/products/kente-3.jpg'
        ]),
        primary_image: '/uploads/products/kente-1.jpg',
        average_rating: 4.7,
        reviews_count: randomPrice(10, 20),
        sales_count: randomPrice(12, 25),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Bogolan "Terre de Mali"',
        slug: 'bogolan-terre-mali',
        description: 'Tissu Bogolan authentique du Mali, teint avec des pigments naturels selon des techniques ancestrales. Motifs géométriques symbolisant la terre et la fertilité.',
        short_description: 'Bogolan authentique du Mali - teinture naturelle',
        sku: 'TIS-BOG-002',
        store_id: tissagesKoffi.id,
        category_id: tisseCat.id,
        price: randomPrice(18000, 30000),
        currency: 'FCFA',
        fabric_type: 'Bogolan',
        fabric_origin: 'Mali',
        cultural_significance: JSON.stringify({
          fr: 'Tissu de terre, utilisé traditionnellement pour les rites de passage',
          en: 'Earth cloth, traditionally used for rites of passage'
        }),
        care_instructions: 'Lavage doux, éviter les détergents chimiques',
        colors_available: JSON.stringify(['Brun et blanc', 'Ocre et noir']),
        materials: JSON.stringify(['Coton', 'Pigments naturels', 'Argile']),
        stock_quantity: randomPrice(6, 15),
        status: 'active',
        featured: true,
        artisan_name: 'Koffi Mensah',
        occasions: JSON.stringify(['décoration', 'vêtement traditionnel', 'art']),
        tags: JSON.stringify(['bogolan', 'mali', 'naturel', 'terre', 'ancestral']),
        images: JSON.stringify([
          '/uploads/products/bogolan-1.jpg',
          '/uploads/products/bogolan-2.jpg'
        ]),
        primary_image: '/uploads/products/bogolan-1.jpg',
        average_rating: 4.5,
        reviews_count: randomPrice(8, 15),
        sales_count: randomPrice(10, 20),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      // Produits supplémentaires pour enrichir le catalogue
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Collier Perles d\'Afrique',
        slug: 'collier-perles-afrique',
        description: 'Magnifique collier artisanal en perles africaines traditionnelles, chaque perle raconte l\'histoire du continent.',
        short_description: 'Collier artisanal en perles africaines traditionnelles',
        sku: 'AFR-BIJ-003',
        store_id: afrikStyle.id,
        category_id: bijouCat.id,
        price: randomPrice(12000, 20000),
        currency: 'FCFA',
        fabric_type: 'Perles',
        fabric_origin: 'Ghana',
        materials: JSON.stringify(['Perles en verre', 'Fil de coton ciré']),
        stock_quantity: randomPrice(25, 50),
        status: 'active',
        featured: false,
        customizable: true,
        requires_shipping: true,
        shipping_weight: 100,
        fragile: true,
        artisan_name: 'Fatou Bamba',
        colors_available: JSON.stringify(['Multicolore', 'Bleu et blanc', 'Rouge et or']),
        occasions: JSON.stringify(['quotidien', 'soirée', 'cadeau']),
        tags: JSON.stringify(['bijoux', 'perles', 'ghana', 'artisanal']),
        images: JSON.stringify(['/uploads/products/collier-perles-1.jpg']),
        primary_image: '/uploads/products/collier-perles-1.jpg',
        average_rating: 4.3,
        reviews_count: randomPrice(15, 25),
        sales_count: randomPrice(20, 40),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Agbada Cérémonie "Dignité"',
        slug: 'agbada-ceremonie-dignite',
        description: 'Agbada traditionnel pour homme, brodé à la main avec des motifs symbolisant la dignité et le respect. Parfait pour les cérémonies importantes.',
        short_description: 'Agbada traditionnel brodé main pour cérémonies',
        sku: 'ELE-AGB-003',
        store_id: eleganceTogo.id,
        category_id: dashikiCat.id,
        price: randomPrice(95000, 150000),
        compare_at_price: randomPrice(160000, 200000),
        currency: 'FCFA',
        fabric_type: 'Bazin brodé',
        fabric_origin: 'Niger',
        colors_available: JSON.stringify(['Blanc crème', 'Bleu royal', 'Noir']),
        sizes_available: JSON.stringify(['M', 'L', 'XL', 'XXL', 'XXXL']),
        materials: JSON.stringify(['Bazin Riche', 'Broderie dorée']),
        stock_quantity: randomPrice(3, 10),
        status: 'active',
        featured: true,
        customizable: true,
        artisan_name: 'Aïsha Diallo',
        occasions: JSON.stringify(['mariage', 'baptême', 'cérémonie religieuse']),
        tags: JSON.stringify(['agbada', 'homme', 'cérémonie', 'broderie', 'niger']),
        images: JSON.stringify([
          '/uploads/products/agbada-dignite-1.jpg',
          '/uploads/products/agbada-dignite-2.jpg'
        ]),
        primary_image: '/uploads/products/agbada-dignite-1.jpg',
        average_rating: 4.8,
        reviews_count: randomPrice(5, 12),
        sales_count: randomPrice(2, 8),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ];
  
    // Insérer les produits
    await knex('products').insert(products);
  
    // Mettre à jour les compteurs de produits dans les boutiques
    for (const store of stores) {
      const productCount = products.filter(p => p.store_id === store.id).length;
      await knex('stores')
        .where({ id: store.id })
        .update({ total_products: productCount });
    }
  
    // Mettre à jour les compteurs de produits dans les catégories
    for (const category of categories) {
      const productCount = products.filter(p => p.category_id === category.id).length;
      await knex('categories')
        .where({ id: category.id })
        .update({ products_count: productCount });
    }
  
    console.log('✅ Produits de test créés avec succès');
    console.log(`📦 ${products.length} produits ajoutés au catalogue`);
    console.log('🏪 Boutiques:');
    console.log(`   - AfrikStyle: ${products.filter(p => p.store_id === afrikStyle.id).length} produits`);
    console.log(`   - Élégance Togo: ${products.filter(p => p.store_id === eleganceTogo.id).length} produits`);
    console.log(`   - Tissages Koffi: ${products.filter(p => p.store_id === tissagesKoffi.id).length} produits`);
  };