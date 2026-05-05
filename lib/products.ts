export interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
}

// This is the source of truth for all products.
// All UI to display products should pull from this array.
// IDs passed to the checkout session should be the same as IDs from this array.
export const PRODUCTS: Product[] = [
  {
    id: "comforter-wash",
    name: "Comforter Wash & Delivery",
    description: "Professional comforter washing with free pickup & delivery. Any size.",
    priceInCents: 2900, // $29.00 per comforter
  },
  {
    id: "wash-fold",
    name: "Wash & Fold",
    description: "Laundry washed, dried, folded, and delivered. Pickup included.",
    priceInCents: 250, // $2.50 per pound — quantity = number of pounds
  },
]
