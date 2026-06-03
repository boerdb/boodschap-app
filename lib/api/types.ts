export interface ListItem {
  id: number;
  barcode: string | null;
  name: string;
  quantity: number;
  checked: boolean;
  addedBy: number | null;
  updatedAt: number;
}

export interface SessionInfo {
  token: string;
  userId: number;
  displayName: string;
  householdId: number;
  householdName: string;
}

export interface OffProduct {
  name: string;
  brand?: string;
  imageUrl?: string;
  barcode: string;
}
