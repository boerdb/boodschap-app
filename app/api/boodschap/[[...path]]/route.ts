import { handleApi } from "@/lib/server/handler";

type Params = { params: Promise<{ path?: string[] }> };

async function buildContext(
  request: Request,
  params: { path?: string[] }
): Promise<Parameters<typeof handleApi>[0]> {
  const segments = params.path ?? [];
  const path = "/" + segments.join("/");
  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  if (request.method !== "GET" && request.method !== "DELETE") {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;

  return {
    path,
    method: request.method,
    searchParams: url.searchParams,
    body,
    token,
  };
}

export async function GET(request: Request, { params }: Params) {
  return handleApi(await buildContext(request, await params));
}

export async function POST(request: Request, { params }: Params) {
  return handleApi(await buildContext(request, await params));
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(await buildContext(request, await params));
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(await buildContext(request, await params));
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
