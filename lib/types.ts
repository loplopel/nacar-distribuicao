export type Role = 'admin' | 'vendedor' | 'cliente';
export type Profile = { id:string; name:string; email:string; role:Role; seller_id:string|null; customer_id:string|null; active:boolean };
export type Customer = { id:string; name:string; trade_name:string|null; legal_name:string|null; cnpj:string|null; city:string|null; state:string|null; phone:string|null; whatsapp:string|null; email:string|null; seller_id:string|null; payment_terms:string|null; credit_limit:number; active:boolean };
export type Product = { id:string; source_key:string|null; plu:string; ean:string|null; name:string; brand:string|null; category:string|null; size:string|null; status:string; suggested_price:number; cost_price:number; minimum_price:number; stock:number; image_url:string|null; active:boolean };
export type CartItem = Product & { quantity:number; notes?:string };
