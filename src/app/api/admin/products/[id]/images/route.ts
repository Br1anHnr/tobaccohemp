import { NextRequest } from "next/server";
import { addImage, listImages, reorderImages } from "@/modules/catalog";
import { revalidateStorefrontCatalog } from "@/lib/storefront";
import { adminRoute, jsonInput } from "@/shared/server/admin-http";
import { adminMutation } from "@/shared/server/admin-mutation";
import { AdminError } from "@/shared/server/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function imageFile(request: NextRequest): Promise<{ file: File; alt: string }> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    throw new AdminError(422, "VALIDATION", "Envie um formulário multipart com o campo 'file'.");
  }
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new AdminError(422, "VALIDATION", "Campo 'file' ausente ou inválido.");
  const altValue = formData.get("alt");
  return { file, alt: typeof altValue === "string" ? altValue.trim().slice(0, 160) : "" };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async () => {
    const { id } = await context.params;
    return adminMutation(db => listImages(id, db));
  }, { role: "operator" })(_request);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async () => {
    const { id } = await context.params;
    const { file, alt } = await imageFile(request);
    const image = await adminMutation(db => addImage(id, file, alt, db));
    revalidateStorefrontCatalog();
    return image;
  }, { status: 201 })(request);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminRoute(async request => {
    const { id } = await context.params;
    const input = await jsonInput(request);
    const result = await adminMutation(db => reorderImages(id, input, db));
    revalidateStorefrontCatalog();
    return result;
  })(request);
}
