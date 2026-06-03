import {
  addListItem,
  deleteListItem,
  patchListItem,
} from "@/lib/api/client";
import { getSession } from "@/lib/auth/session";
import { getQueue, setQueue } from "./queue";

function isStaleActionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("niet gevonden") ||
    msg.includes("Geen toegang") ||
    msg.includes("Sessie verlopen")
  );
}

export async function flushOfflineQueue(): Promise<void> {
  if (!navigator.onLine) return;
  const session = getSession();
  if (!session) return;

  const queue = await getQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const action of queue) {
    try {
      if (action.type === "add") {
        await addListItem(session.householdId, {
          name: String(action.payload.name ?? ""),
          barcode: action.payload.barcode
            ? String(action.payload.barcode)
            : undefined,
          quantity: Number(action.payload.quantity ?? 1),
        });
      } else if (action.type === "patch") {
        const itemId = Number(action.payload.itemId);
        if (itemId < 0) continue;
        await patchListItem(itemId, {
          checked: action.payload.checked as boolean | undefined,
          quantity: action.payload.quantity as number | undefined,
          name: action.payload.name as string | undefined,
        });
      } else if (action.type === "delete") {
        const itemId = Number(action.payload.itemId);
        if (itemId < 0) continue;
        await deleteListItem(itemId);
      }
    } catch (err) {
      if (!isStaleActionError(err)) {
        remaining.push(action);
      }
    }
  }
  await setQueue(remaining);
}
