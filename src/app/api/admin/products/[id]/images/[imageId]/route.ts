import { NextRequest } from "next/server";
import { deleteImage, replaceImage } from "@/modules/catalog";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
import { AdminError } from "@/shared/server/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string; imageId: string }> }) {
  return adminRoute(async () => {
    const { id, imageId } = await context.params;
    const result = await adminMutation(db => deleteImage(id, imageId, db));
    revalidateStorefrontCatalog();
    return result;
  })(_request);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; imageId: string }> }) {
  return adminRoute(async () => {
    const { id, imageId } = await context.params;
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      throw new AdminError(422, "VALIDATION", "Envie um formulário multipart com o campo 'file'.");
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AdminError(422, "VALIDATION", "Campo 'file' ausente ou inválido.");
    const result = await adminMutation(db => replaceImage(id, imageId, file, db));
    revalidateStorefrontCatalog();
    return result;
  })(request);
}
