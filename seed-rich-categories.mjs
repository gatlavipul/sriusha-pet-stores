import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log("Seeding rich categories and images...");

  const categories = [
    {
      name: 'Dog Care',
      slug: 'dog',
      description: 'Nutrition, treats, toys & essentials for dogs',
      image_url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80'
    },
    {
      name: 'Cat Care',
      slug: 'cat',
      description: 'Wholesome food, litter & wellness for cats',
      image_url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80'
    },
    {
      name: 'Birds',
      slug: 'bird',
      description: 'Seeds, treats, perches & accessories for birds',
      image_url: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=600&q=80'
    },
    {
      name: 'Pet Food',
      slug: 'pet-food',
      description: 'Dry food, gravy pouches & prescription diets',
      image_url: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80'
    },
    {
      name: 'Grooming & Hygiene',
      slug: 'grooming',
      description: 'Shampoos, conditioners, brushes & hygiene',
      image_url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=600&q=80'
    },
    {
      name: 'Veterinary Healthcare',
      slug: 'healthcare',
      description: 'Dewormers, flea & tick, supplements & first aid',
      image_url: 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=600&q=80'
    }
  ];

  for (const cat of categories) {
    const existing = await sql`SELECT id FROM categories WHERE slug = ${cat.slug}`;
    if (existing.length > 0) {
      await sql`UPDATE categories SET 
        name = ${cat.name},
        description = ${cat.description},
        image_url = ${cat.image_url}
        WHERE slug = ${cat.slug}`;
      console.log(`Updated category: ${cat.name}`);
    } else {
      await sql`INSERT INTO categories (name, slug, description, image_url)
        VALUES (${cat.name}, ${cat.slug}, ${cat.description}, ${cat.image_url})`;
      console.log(`Inserted category: ${cat.name}`);
    }
  }

  console.log("Categories seeded successfully!");
}

main().catch(console.error);
