/**
 * Seed pour créer les catégories de mode africaine
 */
exports.seed = async function(knex) {
    // Supprimer les données existantes
    await knex('categories').del();
  
    // Insérer les catégories principales
    await knex('categories').insert([
      // Catégories principales (niveau 0)
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Vêtements Femmes',
        slug: 'vetements-femmes',
        description: 'Collection complète de vêtements traditionnels et modernes pour femmes',
        image_url: '/uploads/categories/femmes.jpg',
        icon: 'female',
        parent_id: null,
        level: 0,
        path: '1',
        sort_order: 1,
        is_active: true,
        featured: true,
        show_in_menu: true,
        meta_title: 'Vêtements Femmes - Mode Africaine Authentique',
        meta_description: 'Découvrez notre collection de vêtements traditionnels africains pour femmes: robes, boubous, ensembles en wax et plus encore.',
        meta_keywords: JSON.stringify(['vêtements femmes', 'mode africaine', 'wax', 'boubou', 'robe traditionnelle']),
        translations: JSON.stringify({
          fr: {
            name: 'Vêtements Femmes',
            description: 'Collection complète de vêtements traditionnels et modernes pour femmes'
          },
          en: {
            name: 'Women\'s Clothing',
            description: 'Complete collection of traditional and modern women\'s clothing'
          }
        }),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Vêtements Hommes',
        slug: 'vetements-hommes',
        description: 'Collection de vêtements traditionnels et contemporains pour hommes',
        image_url: '/uploads/categories/hommes.jpg',
        icon: 'male',
        parent_id: null,
        level: 0,
        path: '2',
        sort_order: 2,
        is_active: true,
        featured: true,
        show_in_menu: true,
        meta_title: 'Vêtements Hommes - Mode Africaine Authentique',
        meta_description: 'Explorez notre sélection de vêtements africains pour hommes: dashiki, agbada, complets traditionnels.',
        meta_keywords: JSON.stringify(['vêtements hommes', 'dashiki', 'agbada', 'complet africain']),
        translations: JSON.stringify({
          fr: {
            name: 'Vêtements Hommes',
            description: 'Collection de vêtements traditionnels et contemporains pour hommes'
          },
          en: {
            name: 'Men\'s Clothing',
            description: 'Collection of traditional and contemporary men\'s clothing'
          }
        }),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Enfants',
        slug: 'enfants',
        description: 'Vêtements traditionnels africains pour enfants et bébés',
        image_url: '/uploads/categories/enfants.jpg',
        icon: 'child',
        parent_id: null,
        level: 0,
        path: '3',
        sort_order: 3,
        is_active: true,
        featured: true,
        show_in_menu: true,
        meta_title: 'Vêtements Enfants - Mode Africaine',
        meta_description: 'Collection adorable de vêtements africains pour enfants et bébés.',
        meta_keywords: JSON.stringify(['vêtements enfants', 'bébé', 'mode africaine enfant']),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: '44444444-4444-4444-4444-444444444444',
        name: 'Accessoires',
        slug: 'accessoires',
        description: 'Bijoux, sacs, chaussures et accessoires de mode africaine',
        image_url: '/uploads/categories/accessoires.jpg',
        icon: 'accessories',
        parent_id: null,
        level: 0,
        path: '4',
        sort_order: 4,
        is_active: true,
        featured: true,
        show_in_menu: true,
        meta_title: 'Accessoires Africains - Bijoux et Maroquinerie',
        meta_description: 'Complétez votre style avec nos accessoires authentiques: bijoux, sacs, foulards...',
        meta_keywords: JSON.stringify(['accessoires', 'bijoux africains', 'sacs', 'foulards']),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'Tissus et Textiles',
        slug: 'tissus-textiles',
        description: 'Tissus wax, kente, bogolan et autres textiles africains authentiques',
        image_url: '/uploads/categories/tissus.jpg',
        icon: 'fabric',
        parent_id: null,
        level: 0,
        path: '5',
        sort_order: 5,
        is_active: true,
        featured: false,
        show_in_menu: true,
        meta_title: 'Tissus Africains - Wax, Kente, Bogolan',
        meta_description: 'Découvrez notre sélection de tissus africains authentiques pour vos créations.',
        meta_keywords: JSON.stringify(['tissus africains', 'wax', 'kente', 'bogolan', 'textile']),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);
  
    // Sous-catégories pour Vêtements Femmes (niveau 1)
    await knex('categories').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Robes',
        slug: 'robes',
        description: 'Robes traditionnelles et modernes en tissus africains',
        image_url: '/uploads/categories/robes.jpg',
        parent_id: '11111111-1111-1111-1111-111111111111',
        level: 1,
        path: '1.1',
        sort_order: 1,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Boubous & Caftans',
        slug: 'boubous-caftans',
        description: 'Boubous élégants et caftans traditionnels pour femmes',
        image_url: '/uploads/categories/boubous.jpg',
        parent_id: '11111111-1111-1111-1111-111111111111',
        level: 1,
        path: '1.2',
        sort_order: 2,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Ensembles & Complets',
        slug: 'ensembles-complets',
        description: 'Ensembles coordonnés et complets femmes en wax et autres tissus',
        image_url: '/uploads/categories/ensembles-femmes.jpg',
        parent_id: '11111111-1111-1111-1111-111111111111',
        level: 1,
        path: '1.3',
        sort_order: 3,
        is_active: true,
        featured: false,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Hauts & Blouses',
        slug: 'hauts-blouses',
        description: 'Tops, chemisiers et blouses en tissus africains',
        image_url: '/uploads/categories/hauts.jpg',
        parent_id: '11111111-1111-1111-1111-111111111111',
        level: 1,
        path: '1.4',
        sort_order: 4,
        is_active: true,
        featured: false,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Jupes & Pagnes',
        slug: 'jupes-pagnes',
        description: 'Jupes traditionnelles et pagnes assortis',
        image_url: '/uploads/categories/jupes.jpg',
        parent_id: '11111111-1111-1111-1111-111111111111',
        level: 1,
        path: '1.5',
        sort_order: 5,
        is_active: true,
        featured: false,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);
  
    // Sous-catégories pour Vêtements Hommes (niveau 1)
    await knex('categories').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Dashiki',
        slug: 'dashiki',
        description: 'Dashikis authentiques et modernes pour hommes',
        image_url: '/uploads/categories/dashiki.jpg',
        parent_id: '22222222-2222-2222-2222-222222222222',
        level: 1,
        path: '2.1',
        sort_order: 1,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Agbada & Grands Boubous',
        slug: 'agbada-grands-boubous',
        description: 'Agbadas élégants et grands boubous traditionnels',
        image_url: '/uploads/categories/agbada.jpg',
        parent_id: '22222222-2222-2222-2222-222222222222',
        level: 1,
        path: '2.2',
        sort_order: 2,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Complets Traditionnels',
        slug: 'complets-traditionnels',
        description: 'Complets et ensembles traditionnels pour hommes',
        image_url: '/uploads/categories/complets-hommes.jpg',
        parent_id: '22222222-2222-2222-2222-222222222222',
        level: 1,
        path: '2.3',
        sort_order: 3,
        is_active: true,
        featured: false,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);
  
    // Sous-catégories pour Accessoires (niveau 1)
    await knex('categories').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Bijoux',
        slug: 'bijoux',
        description: 'Bijoux artisanaux africains authentiques',
        image_url: '/uploads/categories/bijoux.jpg',
        parent_id: '44444444-4444-4444-4444-444444444444',
        level: 1,
        path: '4.1',
        sort_order: 1,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Sacs & Maroquinerie',
        slug: 'sacs-maroquinerie',
        description: 'Sacs, pochettes et articles de maroquinerie africaine',
        image_url: '/uploads/categories/sacs.jpg',
        parent_id: '44444444-4444-4444-4444-444444444444',
        level: 1,
        path: '4.2',
        sort_order: 2,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Foulards & Châles',
        slug: 'foulards-chales',
        description: 'Foulards, châles et étoles en tissus africains',
        image_url: '/uploads/categories/foulards.jpg',
        parent_id: '44444444-4444-4444-4444-444444444444',
        level: 1,
        path: '4.3',
        sort_order: 3,
        is_active: true,
        featured: false,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Chaussures & Sandales',
        slug: 'chaussures-sandales',
        description: 'Chaussures et sandales artisanales africaines',
        image_url: '/uploads/categories/chaussures.jpg',
        parent_id: '44444444-4444-4444-4444-444444444444',
        level: 1,
        path: '4.4',
        sort_order: 4,
        is_active: true,
        featured: false,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);
  
    // Sous-catégories pour Tissus (niveau 1)
    await knex('categories').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Tissus Wax',
        slug: 'tissus-wax',
        description: 'Tissus wax authentiques de diverses origines',
        image_url: '/uploads/categories/wax.jpg',
        parent_id: '55555555-5555-5555-5555-555555555555',
        level: 1,
        path: '5.1',
        sort_order: 1,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Kente',
        slug: 'kente',
        description: 'Tissus Kente traditionnels du Ghana',
        image_url: '/uploads/categories/kente.jpg',
        parent_id: '55555555-5555-5555-5555-555555555555',
        level: 1,
        path: '5.2',
        sort_order: 2,
        is_active: true,
        featured: true,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      },
  
      {
        id: knex.raw('gen_random_uuid()'),
        name: 'Bogolan',
        slug: 'bogolan',
        description: 'Tissus Bogolan (mudcloth) du Mali',
        image_url: '/uploads/categories/bogolan.jpg',
        parent_id: '55555555-5555-5555-5555-555555555555',
        level: 1,
        path: '5.3',
        sort_order: 3,
        is_active: true,
        featured: false,
        show_in_menu: true,
        products_count: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }
    ]);
  
    console.log('✅ Catégories de test créées avec succès');
    console.log('📂 Catégories principales: Femmes, Hommes, Enfants, Accessoires, Tissus');
  };