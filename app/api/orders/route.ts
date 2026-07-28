import { NextResponse } from "next/server";
import {
  createClient,
  getCurrentProfile,
} from "@/lib/supabase-server";
import { z } from "zod";

type ProductRecord = {
  id: string;
  stock: number | string | null;
  status: string | null;
  cost_price: number | string | null;
  active: boolean | null;
};

type RequestedItem = {
  product_id: string;
  quantity: number;
  notes?: string | null;
};

type CustomerRecord = {
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  payment_terms: string | null;
  seller_id: string | null;
};

type CurrentProfile = {
  id: string;
  role: "admin" | "vendedor" | "cliente";
  customer_id?: string | null;
  seller_id?: string | null;
};

type OrderStatus = "rascunho" | "orcamento" | "novo";

const schema = z.object({
  order_id: z.string().uuid().nullable().optional(),

  customer_id: z.string().uuid().nullable().optional(),

  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .min(1),

  notes: z.string().max(1500).optional(),

  action: z
    .enum(["draft", "submit", "quote"])
    .default("submit"),
});

type Parsed = z.infer<typeof schema>;

function getOrderStatus(action: Parsed["action"]): OrderStatus {
  if (action === "draft") {
    return "rascunho";
  }

  if (action === "quote") {
    return "orcamento";
  }

  return "novo";
}

async function prepareOrder(
  data: Parsed,
  profile: CurrentProfile,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const productIds = Array.from(
    new Set(
      data.items.map(
        (item: RequestedItem) => item.product_id
      )
    )
  );

  const {
    data: productsData,
    error: productsError,
  } = await supabase
    .from("products")
    .select(
      "id,cost_price,active,stock,status"
    )
    .in("id", productIds)
    .eq("active", true);

  if (productsError) {
    throw new Error(
      `Erro ao consultar produtos: ${productsError.message}`
    );
  }

  const products =
    (productsData ?? []) as ProductRecord[];

  if (products.length !== productIds.length) {
    throw new Error(
      "Produto inválido, inativo ou indisponível."
    );
  }

  const productMap = new Map<string, ProductRecord>(
    products.map((product: ProductRecord) => [
      product.id,
      product,
    ])
  );

  for (const requested of data.items as RequestedItem[]) {
    const product = productMap.get(
      requested.product_id
    );

    if (!product) {
      throw new Error(
        "Um dos produtos do pedido não foi localizado."
      );
    }

    const currentStock = Number(product.stock ?? 0);
    const requestedQuantity = Number(
      requested.quantity
    );

    const normalizedStatus = String(
      product.status ?? ""
    )
      .trim()
      .toLowerCase();

    if (
      currentStock < requestedQuantity ||
      normalizedStatus === "indisponível" ||
      normalizedStatus === "indisponivel"
    ) {
      throw new Error(
        "Há produto sem estoque suficiente no pedido."
      );
    }
  }

  const items = (
    data.items as RequestedItem[]
  ).map((item: RequestedItem) => {
    const product = productMap.get(
      item.product_id
    );

    if (!product) {
      throw new Error(
        `Produto não localizado: ${item.product_id}`
      );
    }

    const unitPrice = Number(
      product.cost_price ?? 0
    );

    if (!Number.isFinite(unitPrice)) {
      throw new Error(
        "Um dos produtos possui valor inválido."
      );
    }

    return {
      product_id: item.product_id,
      quantity: item.quantity,
      notes: item.notes?.trim() || null,
      unit_price: unitPrice,
    };
  });

  const total = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unit_price,
    0
  );

  let customerId =
    profile.customer_id ?? null;

  let sellerId =
    profile.seller_id ?? null;

  let customerName: string | null = null;
  let customerCnpj: string | null = null;
  let customerCity: string | null = null;
  let customerState: string | null = null;
  let paymentTerms: string | null = null;

  if (profile.role === "vendedor") {
    customerId = data.customer_id ?? null;
    sellerId = profile.id;

    if (!customerId) {
      throw new Error(
        "Selecione o cliente."
      );
    }
  }

  if (
    profile.role === "admin" &&
    data.customer_id
  ) {
    customerId = data.customer_id;
  }

  if (profile.role === "cliente") {
    if (!customerId) {
      throw new Error(
        "Seu usuário não está vinculado a uma empresa."
      );
    }
  }

  if (customerId) {
    let customerQuery = supabase
      .from("customers")
      .select(
        "name,cnpj,city,state,payment_terms,seller_id"
      )
      .eq("id", customerId);

    if (profile.role === "vendedor") {
      customerQuery = customerQuery.eq(
        "seller_id",
        profile.id
      );
    }

    const {
      data: customerData,
      error: customerError,
    } = await customerQuery.maybeSingle();

    if (customerError) {
      throw new Error(
        `Erro ao consultar cliente: ${customerError.message}`
      );
    }

    if (!customerData) {
      throw new Error(
        "Cliente inválido ou fora da sua carteira."
      );
    }

    const customer =
      customerData as CustomerRecord;

    customerName = customer.name;
    customerCnpj = customer.cnpj;
    customerCity = customer.city;
    customerState = customer.state;
    paymentTerms = customer.payment_terms;

    sellerId =
      sellerId ?? customer.seller_id;
  }

  const status = getOrderStatus(
    data.action
  );

  const now = new Date().toISOString();

  return {
    items,
    status,
    total,
    now,

    orderData: {
      customer_id: customerId,
      seller_id: sellerId,
      status,
      total,
      notes: data.notes?.trim() || null,
      customer_name: customerName,
      customer_cnpj: customerCnpj,
      customer_city: customerCity,
      customer_state: customerState,
      payment_terms: paymentTerms,
      submitted_at:
        status === "novo" ? now : null,
      quote_requested_at:
        status === "orcamento" ? now : null,
      updated_at: now,
    },
  };
}

async function writeEvent(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  orderId: string,
  profileId: string,
  status: OrderStatus,
  description: string
) {
  const { error } = await supabase
    .from("order_events")
    .insert({
      order_id: orderId,
      created_by: profileId,
      status,
      description,
    });

  if (error) {
    console.error(
      "Não foi possível registrar o evento do pedido:",
      error.message
    );
  }
}

export async function POST(
  request: Request
) {
  const rawProfile =
    await getCurrentProfile();

  if (!rawProfile) {
    return NextResponse.json(
      {
        error: "Não autenticado.",
      },
      {
        status: 401,
      }
    );
  }

  const profile =
    rawProfile as CurrentProfile;

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Corpo da requisição inválido.",
      },
      {
        status: 400,
      }
    );
  }

  const parsed =
    schema.safeParse(requestBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos.",
        details: parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  try {
    const supabase =
      await createClient();

    const prepared = await prepareOrder(
      parsed.data,
      profile,
      supabase
    );

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from("orders")
      .insert({
        created_by: profile.id,
        ...prepared.orderData,
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(orderError.message);
    }

    const orderItems =
      prepared.items.map((item) => ({
        ...item,
        order_id: order.id,
      }));

    const { error: itemError } =
      await supabase
        .from("order_items")
        .insert(orderItems);

    if (itemError) {
      await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);

      throw new Error(itemError.message);
    }

    const descriptions: Record<
      OrderStatus,
      string
    > = {
      rascunho: "Rascunho criado.",
      novo: "Pedido enviado.",
      orcamento:
        "Solicitação de orçamento enviada.",
    };

    await writeEvent(
      supabase,
      order.id,
      profile.id,
      prepared.status,
      descriptions[prepared.status]
    );

    return NextResponse.json(order, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "Erro ao criar pedido:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o pedido.",
      },
      {
        status: 400,
      }
    );
  }
}

export async function PATCH(
  request: Request
) {
  const rawProfile =
    await getCurrentProfile();

  if (!rawProfile) {
    return NextResponse.json(
      {
        error: "Não autenticado.",
      },
      {
        status: 401,
      }
    );
  }

  const profile =
    rawProfile as CurrentProfile;

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Corpo da requisição inválido.",
      },
      {
        status: 400,
      }
    );
  }

  const parsed =
    schema.safeParse(requestBody);

  if (
    !parsed.success ||
    !parsed.data.order_id
  ) {
    return NextResponse.json(
      {
        error: "Dados inválidos.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const supabase =
      await createClient();

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("orders")
      .select(
        "id,number,status,created_by,seller_id"
      )
      .eq("id", parsed.data.order_id)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        existingError.message
      );
    }

    if (
      !existing ||
      existing.status !== "rascunho"
    ) {
      throw new Error(
        "Este rascunho não pode mais ser alterado."
      );
    }

    if (
      profile.role === "cliente" &&
      existing.created_by !== profile.id
    ) {
      throw new Error("Acesso negado.");
    }

    if (
      profile.role === "vendedor" &&
      existing.seller_id !== profile.id
    ) {
      throw new Error("Acesso negado.");
    }

    const prepared = await prepareOrder(
      parsed.data,
      profile,
      supabase
    );

    const { error: updateError } =
      await supabase
        .from("orders")
        .update(prepared.orderData)
        .eq("id", existing.id);

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    const { error: deleteItemsError } =
      await supabase
        .from("order_items")
        .delete()
        .eq("order_id", existing.id);

    if (deleteItemsError) {
      throw new Error(
        deleteItemsError.message
      );
    }

    const updatedItems =
      prepared.items.map((item) => ({
        ...item,
        order_id: existing.id,
      }));

    const { error: insertItemsError } =
      await supabase
        .from("order_items")
        .insert(updatedItems);

    if (insertItemsError) {
      throw new Error(
        insertItemsError.message
      );
    }

    const descriptions: Record<
      OrderStatus,
      string
    > = {
      rascunho:
        "Rascunho atualizado.",
      novo:
        "Rascunho enviado como pedido.",
      orcamento:
        "Rascunho enviado para orçamento.",
    };

    await writeEvent(
      supabase,
      existing.id,
      profile.id,
      prepared.status,
      descriptions[prepared.status]
    );

    return NextResponse.json({
      ...existing,
      status: prepared.status,
      total: prepared.total,
    });
  } catch (error) {
    console.error(
      "Erro ao atualizar rascunho:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o rascunho.",
      },
      {
        status: 400,
      }
    );
  }
}