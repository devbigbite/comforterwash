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
    name: "Comforter Wash Service",
    description: "Professional comforter washing and cleaning service with pickup and delivery",
    priceInCents: 2900, // Updated from $25 to $29 per comforter to match WashFold pricing
  },
]
