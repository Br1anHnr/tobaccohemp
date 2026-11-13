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
  const editing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(product ? String(product.price).replace(".", ",") : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [categorySlug, setCategorySlug] = useState(product?.categorySlug ?? "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [active, setActive] = useState(product?.active ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [images, setImages] = useState<FormImage[]>(
    (product?.images ?? []).map((image) => ({ id: image.id, url: image.url })),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setImages((current) => [
      ...current,
      ...Array.from(files).map((file) => ({ url: URL.createObjectURL(file), file })),
    ]);
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const target = current[index];
      if (target && !target.id) URL.revokeObjectURL(target.url);
      return current.filter((_, i) => i !== index);
    });
  };

  const replaceImage = (index: number, file: File) => {
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
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setPending(true);
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
      };

      let productId: string;
      if (editing && product) {
        await updateProduct(product.id, input);
        productId = product.id;
      } else {
        const created = await createProduct(input);
        productId = created.id;
      }
      await updateStock(productId, parsedStock, product?.reorderPoint ?? 0);

      // Resolve images: upload new files, replace edited files, then reorder.
      const originalIds = (product?.images ?? []).map((image) => image.id);
      const kept = new Set<string>();
      for (const image of images) {
        if (image.id) kept.add(image.id);
      }
      const toDelete = originalIds.filter((id) => !kept.has(id));
      for (const id of toDelete) await deleteProductImage(productId, id);

      const orderedIds: string[] = [];
      for (const image of images) {
        if (image.id) {
          if (image.file) await replaceProductImage(productId, image.id, image.file);
          orderedIds.push(image.id);
        } else if (image.file) {
          const uploaded = await uploadProductImage(productId, image.file, name.trim());
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
    }
  }

  const mainImage = images[0]?.url;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar produto" : "Cadastrar produto"}
      description={
        editing
          ? "Atualize os dados do produto. As alterações refletem na vitrine."
          : "Crie um produto no catálogo. O estoque inicial pode ser definido aqui."
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
            id="product-brand"
            label="Coleção"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            hint="Ex.: Seleção da loja"
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
        <FormField
          id="product-slug"
          label="Slug (URL)"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          hint="Opcional — gerado automaticamente a partir do nome."
        />
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
          <legend>Imagens</legend>
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
          {mainImage && (
            <p className="field-hint">
              A primeira imagem é a principal. Use as setas para reordenar e o
              ícone de upload para substituir.
            </p>
          )}
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
            {pending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
