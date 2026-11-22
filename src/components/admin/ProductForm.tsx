"use client";

import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, ArrowLeft, ArrowRight, Trash2, Star, Upload } from "lucide-react";
import {
  createProduct, updateProduct, updateStock, uploadProductImage, replaceProductImage,
  deleteProductImage, reorderProductImages,
} from "@/lib/admin-service";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import type { AdminProduct, AdminCategory } from "@/types/admin";

interface FormImage {
  id?: string;
  url: string;
  file?: File;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseCommaList(raw: string, maxItems: number, maxLen: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const item = part.trim().slice(0, maxLen);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `Formato inválido (${file.name}). Envie imagens JPG, PNG ou WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `A imagem ${file.name} excede o limite de 5 MB.`;
  }
  return null;
}

export function ProductForm({
  open,
  onClose,
  onSaved,
  product,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: AdminProduct | null;
  categories: AdminCategory[];
}) {
  const [persistedId, setPersistedId] = useState<string | null>(product?.id ?? null);
  const editing = Boolean(persistedId);
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(product ? String(product.price).replace(".", ",") : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [categorySlug, setCategorySlug] = useState(product?.categorySlug ?? "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [reorderPoint, setReorderPoint] = useState(
    product ? String(product.reorderPoint ?? 3) : "3",
  );
  const [variantsText, setVariantsText] = useState((product?.variants ?? []).join(", "));
  const [tagsText, setTagsText] = useState((product?.tags ?? []).join(", "));
  const [active, setActive] = useState(product?.active ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [images, setImages] = useState<FormImage[]>(
    (product?.images ?? []).map((image) => ({ id: image.id, url: image.url })),
  );
  const [pending, setPending] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const accepted: FormImage[] = [];
    for (const file of Array.from(files)) {
      const issue = validateImageFile(file);
      if (issue) {
        setError(issue);
        continue;
      }
      accepted.push({ url: URL.createObjectURL(file), file });
    }
    if (accepted.length) {
      setError("");
      setImages((current) => [...current, ...accepted]);
    }
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const target = current[index];
      if (target && !target.id) URL.revokeObjectURL(target.url);
      return current.filter((_, i) => i !== index);
    });
  };

  const replaceImage = (index: number, file: File) => {
    const issue = validateImageFile(file);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    setImages((current) =>
      current.map((image, i) => {
        if (i !== index) return image;
        if (!image.id && image.url) URL.revokeObjectURL(image.url);
        return { ...image, url: URL.createObjectURL(file), file };
      }),
    );
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Informe o nome.";
    if (!sku.trim()) errors.sku = "Informe o SKU.";
    const parsed = Number(String(price).trim().replace(",", "."));
    if (!price.trim() || !Number.isFinite(parsed) || parsed < 0) {
      errors.price = "Informe um preço válido.";
    }
    const parsedStock = stock.trim() === "" ? 0 : Number(stock);
    if (stock.trim() !== "" && (!Number.isSafeInteger(parsedStock) || parsedStock < 0)) {
      errors.stock = "Informe um estoque válido.";
    }
    const parsedReorder = reorderPoint.trim() === "" ? 0 : Number(reorderPoint);
    if (reorderPoint.trim() !== "" && (!Number.isSafeInteger(parsedReorder) || parsedReorder < 0)) {
      errors.reorderPoint = "Informe um estoque mínimo válido.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setPending(true);
    setProgressText("Salvando produto…");
    setError("");
    try {
      const input = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        priceCents: Math.round(parsed * 100),
        active,
        description: description.trim(),
        brand: brand.trim() || "Seleção da loja",
        slug: slug.trim() || undefined,
        categorySlug: categorySlug || null,
        isNew,
        isFeatured,
        variants: parseCommaList(variantsText, 12, 32),
        tags: parseCommaList(tagsText, 20, 32),
      };

      let productId = persistedId;
      if (productId) {
        await updateProduct(productId, input);
      } else {
        const created = await createProduct(input);
        productId = created.id;
        setPersistedId(created.id);
      }
      await updateStock(productId, parsedStock, parsedReorder);

      // Resolve images: delete removed, upload/replace R2 files incrementally, then reorder.
      const originalIds = (product?.images ?? []).map((image) => image.id);
      const kept = new Set<string>();
      for (const image of images) {
        if (image.id) kept.add(image.id);
      }
      const toDelete = originalIds.filter((id) => !kept.has(id));
      if (toDelete.length || images.some((i) => i.file)) {
        setProgressText("Enviando fotos para o R2…");
      }
      for (const id of toDelete) await deleteProductImage(productId, id);

      const nextImages = [...images];
      const orderedIds: string[] = [];
      for (let i = 0; i < nextImages.length; i++) {
        const image = nextImages[i];
        if (image.id) {
          if (image.file) {
            const replaced = await replaceProductImage(productId, image.id, image.file);
            URL.revokeObjectURL(image.url);
            nextImages[i] = { id: replaced.id, url: replaced.url };
            setImages([...nextImages]);
          }
          orderedIds.push(image.id);
        } else if (image.file) {
          const uploaded = await uploadProductImage(productId, image.file, name.trim());
          URL.revokeObjectURL(image.url);
          nextImages[i] = { id: uploaded.id, url: uploaded.url };
          setImages([...nextImages]);
          orderedIds.push(uploaded.id);
        }
      }
      if (orderedIds.length > 1) {
        await reorderProductImages(
          productId,
          orderedIds.map((id, position) => ({ id, position })),
        );
      }

      onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setPending(false);
      setProgressText("");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar produto" : "Cadastrar produto"}
      description={
        editing
          ? "Atualize os dados do produto. As alterações refletem na vitrine."
          : "Crie um produto real no catálogo e envie as fotos para o Cloudflare R2."
      }
    >
      <form onSubmit={submit} className="admin-form">
        <div className="form-grid-2">
          <FormField
            id="product-name"
            label="Nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldErrors.name}
            required
          />
          <FormField
            id="product-sku"
            label="SKU"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            error={fieldErrors.sku}
            hint="Letras, números, ponto, hífen ou sublinhado."
            required
          />
          <FormField
            id="product-price"
            label="Preço (R$)"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={fieldErrors.price}
            required
          />
          <label className="form-field">
            Categoria
            <select
              aria-label="Categoria"
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <FormField
            id="product-stock"
            label="Estoque"
            type="number"
            min={0}
            step={1}
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            error={fieldErrors.stock}
          />
          <FormField
            id="product-reorder"
            label="Estoque mínimo"
            type="number"
            min={0}
            step={1}
            value={reorderPoint}
            onChange={(event) => setReorderPoint(event.target.value)}
            error={fieldErrors.reorderPoint}
            hint="Alerta de reposição no painel."
          />
          <FormField
            id="product-brand"
            label="Coleção"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            hint="Ex.: Seleção da loja"
          />
          <FormField
            id="product-slug"
            label="Slug (URL)"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            hint="Opcional — gerado a partir do nome."
          />
          <FormField
            id="product-variants"
            label="Variações"
            value={variantsText}
            onChange={(event) => setVariantsText(event.target.value)}
            placeholder="Ex.: Preto, Grafite"
            hint="Separe por vírgula (opcional)."
          />
          <FormField
            id="product-tags"
            label="Tags de busca"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="Ex.: estojo, viagem, metal"
            hint="Separe por vírgula (opcional)."
          />
        </div>
        <div className="form-field">
          <label htmlFor="product-description">Descrição</label>
          <textarea
            id="product-description"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descreva o produto para a vitrine."
          />
        </div>
        <div className="form-grid-2">
          <label className="form-field checkbox-label">
            <input
              type="checkbox"
              id="product-active"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            <span>Disponível na vitrine</span>
          </label>
          <label className="form-field checkbox-label">
            <input
              type="checkbox"
              id="product-featured"
              checked={isFeatured}
              onChange={(event) => setIsFeatured(event.target.checked)}
            />
            <span>Produto em destaque</span>
          </label>
          <label className="form-field checkbox-label">
            <input
              type="checkbox"
              id="product-new"
              checked={isNew}
              onChange={(event) => setIsNew(event.target.checked)}
            />
            <span>Marcar como novidade</span>
          </label>
        </div>

        <fieldset className="image-manager">
          <legend>Imagens (Cloudflare R2)</legend>
          <div className="image-manager__grid">
            {images.map((image, index) => (
              <div
                key={image.id ?? image.url}
                className={`image-slot ${index === 0 ? "is-main" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" />
                {index === 0 && (
                  <span className="image-slot__badge">
                    <Star size={12} aria-hidden="true" /> Principal
                  </span>
                )}
                <div className="image-slot__actions">
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover imagem para a esquerda"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === images.length - 1}
                    aria-label="Mover imagem para a direita"
                  >
                    <ArrowRight size={15} />
                  </button>
                  <label className="image-slot__replace">
                    <Upload size={15} aria-hidden="true" />
                    <span className="sr-only">Substituir imagem</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) replaceImage(index, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label="Remover imagem"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="image-slot image-slot--add"
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={20} aria-hidden="true" />
              Adicionar
            </button>
          </div>
          <p className="field-hint">
            Fotos em JPG, PNG ou WebP (até 5 MB), salvas no Cloudflare R2. A primeira foto é a capa na vitrine.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </fieldset>

        {error && <p role="alert">{error}</p>}
        <div className="admin-form__actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={pending}
          >
            {pending ? (progressText || "Salvando…") : editing ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
