import { requireUser } from "@/app/api/utils/security";
import { getCustomerPetPantry } from "@/utils/petPantryService";

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const pantry = await getCustomerPetPantry(authResult.user.id);
    return Response.json({
      pet: pantry.pet,
      items: pantry.items,
      pantry: pantry.items,
    });
  } catch (error) {
    console.error("Error computing pet pantry:", error);
    return Response.json({ error: "Failed to load pet pantry predictions" }, { status: 500 });
  }
}

