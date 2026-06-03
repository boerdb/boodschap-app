import { get, set } from "idb-keyval";
import type { ListItem } from "@/lib/api/types";

const CACHE_KEY = "boodschap_list_cache";
const QUEUE_KEY = "boodschap_offline_queue";

export interface OfflineAction {
  id: string;
  type: "add" | "patch" | "delete";
  householdId: number;
  payload: Record<string, unknown>;
  createdAt: number;
}

export async function cacheListItems(items: ListItem[]): Promise<void> {
  await set(CACHE_KEY, items);
}

export async function getCachedListItems(): Promise<ListItem[]> {
  return (await get<ListItem[]>(CACHE_KEY)) ?? [];
}

export async function clearOfflineData(): Promise<void> {
  await set(QUEUE_KEY, []);
  await set(CACHE_KEY, []);
}

export async function enqueueAction(
  action: Omit<OfflineAction, "id" | "createdAt">
): Promise<void> {
  const queue = (await get<OfflineAction[]>(QUEUE_KEY)) ?? [];
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  await set(QUEUE_KEY, queue);
}

export async function getQueue(): Promise<OfflineAction[]> {
  return (await get<OfflineAction[]>(QUEUE_KEY)) ?? [];
}

export async function setQueue(queue: OfflineAction[]): Promise<void> {
  await set(QUEUE_KEY, queue);
}
