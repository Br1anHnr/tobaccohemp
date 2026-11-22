"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { fetchCategories, createCategory, updateCategory, deleteCategory } from "@/lib/admin-service";
import { useResource } from "@/lib/use-resource";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import type { AdminCategory } from "@/types/admin";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoriesTable() {
  const { status, data, retry } = useResource(fetchCategories);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const rows = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDescription("");
    setImage("");
    setFormOpen(true);
  };
  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setName(category.name);
    setSlug(category.slug);
    setDescription(category.description);
    setImage(category.image ?? "");
    setFormOpen(true);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !name.trim()) return;
    setPending(true); setError("");
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || slugify(name.trim()),
        description: description.trim(),
        image: image.trim(),
      };
      if (editing) await updateCategory(editing.slug, payload);
      else await createCategory(payload);
      retry();
      setFormOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a categoria.");
    } finally { setPending(false); }
  }

  async function remove(category: AdminCategory) {
    if (pending || category.productCount > 0) return;
    setPending(true); setError("");
    try {
      await deleteCategory(category.slug);
      retry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover a categoria.");
    } finally { setPending(false); }
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <div className="admin-table-actions">
        <button type="button" className="button button-primary" onClick={openCreate}>
          Cadastrar categoria
        </button>
      </div>
      <div className="table-card">
        {status === "loading" && <p className="muted" role="status">Carregando categorias…</p>}
        {status === "error" && (
          <div className="empty-state compact">
            <h3>Não foi possível carregar.</h3>
            <button type="button" className="button button-secondary" onClick={retry}>Tentar novamente</button>
          </div>
        )}
        {status === "success" && rows.length === 0 && (
          <div className="empty-state compact">
            <h3>Nenhuma categoria cadastrada.</h3>
            <p>Cadastre categorias para organizar o catálogo.</p>
          </div>
        )}
        {status === "success" && rows.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <caption>Lista de categorias do catálogo</caption>
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col">Slug</th>
                  <th scope="col" className="num">Produtos</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((category) => (
                  <tr key={category.slug}>
                    <td>
                      <div className="admin-product-cell">
                        {category.image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={category.image} alt="" className="admin-thumb" />
                        ) : (
                          <span className="admin-thumb admin-thumb--empty" aria-hidden="true">Auto</span>
                        )}
                        <div>
                          <span className="cell-primary">{category.name}</span>
                          <span className="cell-sub">{category.description || "Sem descrição"}</span>
                        </div>
                      </div>
                    </td>
                    <td>{category.slug}</td>
                    <td className="num">{category.productCount === 0 ? "Sem produtos" : category.productCount}</td>
                    <td>
                      <span className="row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Editar categoria ${category.name}`}
                          onClick={() => openEdit(category)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remover categoria ${category.name}`}
                          disabled={category.productCount > 0 || pending}
                          title={category.productCount > 0 ? "Remova os produtos antes de excluir." : "Remover categoria"}
                          onClick={() => remove(category)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar categoria" : "Cadastrar categoria"}
        description="Categorias vazias ficam ocultas da vitrine e podem ser removidas."
      >
        <form onSubmit={submit} className="admin-form">
          <FormField
            id="category-name"
            label="Nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <FormField
            id="category-slug"
            label="Slug (URL)"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            hint="Opcional — gerado automaticamente a partir do nome."
          />
          <FormField
            id="category-image"
            label="Imagem de capa (URL)"
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder="https://... (opcional)"
            hint="Opcional. Se vazio, usa a primeira foto de um produto ativo da categoria."
          />
          <div className="form-field">
            <label htmlFor="category-description">Descrição</label>
            <textarea
              id="category-description"
              rows={2}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="admin-form__actions">
            <button type="button" className="button button-secondary" onClick={() => setFormOpen(false)} disabled={pending}>
              Cancelar
            </button>
            <button type="submit" className="button button-primary" disabled={pending}>
              {pending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
