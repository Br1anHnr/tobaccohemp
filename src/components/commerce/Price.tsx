import { currency } from "@/lib/currency";
export function Price({
  price,
  compareAtPrice,
}: {
  price: number;
  compareAtPrice?: number;
}) {
  return (
    <span className="price">
      {compareAtPrice && <del>{currency(compareAtPrice)}</del>}
      <strong>{currency(price)}</strong>
    </span>
  );
}
