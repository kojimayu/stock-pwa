
export interface Product {
    id: number;
    code?: string;
    name: string;
    category: string;
    subCategory?: string | null;
    priceA: number;
    priceB: number;
    stock: number;
    minStock: number;
    createdAt: string;
    updatedAt: string;
    productType?: string | null;
    quantityPerBox?: number;
    pricePerBox?: number;
    manufacturer?: string | null;
    unit?: string;
}
