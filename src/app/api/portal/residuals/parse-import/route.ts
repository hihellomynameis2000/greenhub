import { NextRequest, NextResponse } from "next/server";
import { parseResidualImportBuffer } from "@/lib/portal/residualImportServer";
import { portalErrorResponse, PortalApiError, requirePortalContext } from "@/lib/portal/server";

export async function POST(request: NextRequest) {
  try {
    await requirePortalContext(request, "admin");
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new PortalApiError("Upload a CSV or XLSX residual report.", 400);
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new PortalApiError("Residual import files are limited to 8 MB.", 400);
    }

    const parsed = parseResidualImportBuffer(file.name, await file.arrayBuffer());
    return NextResponse.json(parsed);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
