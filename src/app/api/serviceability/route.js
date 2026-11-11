import { checkServiceability } from "@/utils/serviceabilityService";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pincode = searchParams.get("pincode");
    const subtotal = parseFloat(searchParams.get("subtotal") || "0");

    if (!pincode) {
      return Response.json(
        { error: "Pincode query parameter is required." },
        { status: 400 }
      );
    }

    const result = await checkServiceability(pincode, subtotal);
    return Response.json(result);
  } catch (error) {
    console.error("Serviceability check error:", error);
    return Response.json(
      { error: "Failed to verify pincode serviceability" },
      { status: 500 }
    );
  }
}

