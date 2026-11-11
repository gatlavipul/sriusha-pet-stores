import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { error: "Product IDs array is required" },
        { status: 400 }
      );
    }

    const validIds = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (validIds.length === 0) {
      return Response.json({ error: "No valid product IDs provided" }, { status: 400 });
    }

    // Delete product images
    await sql`DELETE FROM product_images WHERE product_id = ANY(${validIds}::int[])`;

    // Delete products
    const result = await sql`
      DELETE FROM products WHERE id = ANY(${validIds}::int[])
      RETURNING id
    `;

    return Response.json({
      success: true,
      deletedCount: result.length,
    });
  } catch (error) {
    console.error("Error bulk deleting products:", error);
    return Response.json(
      { error: "Failed to delete products" },
      { status: 500 }
    );
  }
}
