import type { NextRequest } from "next/server";
import { apiError, handleError, json } from "@/lib/api";
import { deleteClient, getClient, updateClient } from "@/lib/clients";
import { clientUpdateSchema } from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return apiError("Client not found", 404);
    return json({ client });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = clientUpdateSchema.parse(body);
    const client = await updateClient(id, input);
    return json({ client });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await deleteClient(id);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
