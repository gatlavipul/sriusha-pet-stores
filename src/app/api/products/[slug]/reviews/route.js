import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { sanitizeText } from "@/app/api/utils/security";

export async function GET(request, { params }) {
  try {
    const { slug } = params;

    const prod = await sql`SELECT id FROM products WHERE slug = ${slug} LIMIT 1`;
    if (prod.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const productId = prod[0].id;

    const reviews = await sql`
      SELECT id, customer_name, rating, title, comment, created_at
      FROM product_reviews
      WHERE product_id = ${productId} AND status = 'approved'
      ORDER BY created_at DESC
    `;

    const summary = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(ROUND(AVG(rating)::numeric, 1), 5.0) as average
      FROM product_reviews
      WHERE product_id = ${productId} AND status = 'approved'
    `;

    return Response.json({
      reviews,
      rating: parseFloat(summary[0]?.average || 5.0),
      count: summary[0]?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    return Response.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await auth();
    const { slug } = params;
    const body = await request.json();
    const { rating, comment, title, customer_name } = body;

    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return Response.json({ error: "Rating must be between 1 and 5 stars" }, { status: 400 });
    }

    const cleanComment = sanitizeText(comment, 1000);
    if (!cleanComment || cleanComment.length < 5) {
      return Response.json({ error: "Please write at least a brief comment about your experience." }, { status: 400 });
    }

    const prod = await sql`SELECT id FROM products WHERE slug = ${slug} LIMIT 1`;
    if (prod.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const authorName = sanitizeText(
      customer_name || session?.user?.name || "Verified Customer",
      100
    );

    const inserted = await sql`
      INSERT INTO product_reviews (
        product_id, user_id, customer_name, rating, title, comment, status
      ) VALUES (
        ${prod[0].id}, ${session?.user?.id || null}, ${authorName}, 
        ${parsedRating}, ${sanitizeText(title, 100) || "Customer Review"}, 
        ${cleanComment}, 'approved'
      )
      RETURNING *
    `;

    return Response.json({
      success: true,
      message: "Thank you for sharing your review!",
      review: inserted[0],
    });
  } catch (error) {
    console.error("Error creating review:", error);
    return Response.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
