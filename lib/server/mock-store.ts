import type { ListItem } from "@/lib/api/types";

export interface MockSession {
  token: string;
  userId: number;
  displayName: string;
  householdId: number;
  householdName: string;
}

interface MockState {
  householdId: number;
  householdName: string;
  inviteCode: string;
  nextUserId: number;
  nextItemId: number;
  sessions: Map<string, MockSession>;
  items: ListItem[];
}

const globalForMock = globalThis as typeof globalThis & {
  __boodschapMock?: MockState;
};

function getState(): MockState {
  if (!globalForMock.__boodschapMock) {
    globalForMock.__boodschapMock = {
      householdId: 1,
      householdName: "Thuis",
      inviteCode: "THUIS",
      nextUserId: 1,
      nextItemId: 1,
      sessions: new Map(),
      items: [],
    };
  }
  return globalForMock.__boodschapMock;
}

export function mockLogin(
  displayName: string,
  inviteCode: string
): MockSession | null {
  const state = getState();
  if (inviteCode.toUpperCase() !== state.inviteCode) return null;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const userId = state.nextUserId++;
  const session: MockSession = {
    token,
    userId,
    displayName,
    householdId: state.householdId,
    householdName: state.householdName,
  };
  state.sessions.set(token, session);
  return session;
}

export function mockSession(token: string): MockSession | null {
  return getState().sessions.get(token) ?? null;
}

export function mockListItems(
  householdId: number,
  since?: number
): ListItem[] {
  const state = getState();
  let items = state.items.filter((i) => i.id > 0);
  if (since != null) {
    items = items.filter((i) => i.updatedAt > since);
  }
  return items.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });
}

export function mockAddItem(
  householdId: number,
  userId: number,
  payload: { name: string; barcode?: string; quantity?: number }
): ListItem {
  const state = getState();
  const item: ListItem = {
    id: state.nextItemId++,
    barcode: payload.barcode ?? null,
    name: payload.name,
    quantity: payload.quantity ?? 1,
    checked: false,
    addedBy: userId,
    updatedAt: Math.floor(Date.now() / 1000),
  };
  state.items.push(item);
  return item;
}

export function mockPatchItem(
  itemId: number,
  _householdId: number,
  patch: Partial<{ checked: boolean; quantity: number; name: string }>
): boolean {
  const state = getState();
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return false;
  if (patch.checked !== undefined) item.checked = patch.checked;
  if (patch.quantity !== undefined) item.quantity = patch.quantity;
  if (patch.name !== undefined) item.name = patch.name;
  item.updatedAt = Math.floor(Date.now() / 1000);
  return true;
}

export function mockDeleteItem(itemId: number): boolean {
  const state = getState();
  const idx = state.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return false;
  state.items.splice(idx, 1);
  return true;
}
