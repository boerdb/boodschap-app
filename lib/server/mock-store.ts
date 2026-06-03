import type { ListItem } from "@/lib/api/types";
import type { StoreId } from "@/lib/server/prices/types";

export interface MockSession {
  token: string;
  userId: number;
  displayName: string;
  householdId: number;
  householdName: string;
}

interface MockUser {
  id: number;
  displayName: string;
}

interface MockState {
  householdId: number;
  householdName: string;
  inviteCode: string;
  preferredStores: StoreId[];
  users: MockUser[];
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
      preferredStores: [],
      users: [
        { id: 1, displayName: "Ben" },
        { id: 2, displayName: "Ineke" },
      ],
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
  const user = state.users.find(
    (u) => u.displayName.toLowerCase() === displayName.trim().toLowerCase()
  );
  if (!user) return null;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const session: MockSession = {
    token,
    userId: user.id,
    displayName: user.displayName,
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

export function mockPreferredStores(): StoreId[] {
  return [...getState().preferredStores];
}

export function mockSetPreferredStores(stores: StoreId[]): void {
  getState().preferredStores = [...stores];
}
