export interface Attachment { name: string; url: string; type: string }
export interface Message { id: string; author: string; text: string; date: string; attachment?: Attachment }
export interface Entity {
  id: string; title: string; description: string; date: string;
  category?: string; status?: string; pinned?: boolean; urgent?: boolean; read?: boolean; views?: number;
  attachment?: Attachment; image?: string; amount?: number; type?: string; provider?: string; period?: string; dueDate?: string;
  time?: string; endTime?: string; endDate?: string; place?: string; agenda?: string; summary?: string; unit?: string;
  options?: string[]; votes?: number[]; voted?: number; closed?: boolean; formal?: boolean;
  interested?: boolean; interests?: number; messages?: Message[]; progress?: number; startDate?: string;
  contact?: string; phone?: string; email?: string; milestones?: string[];
}
export type Collection = 'notices'|'movements'|'expenses'|'budgets'|'documents'|'meetings'|'topics'|'polls'|'reservations'|'issues'|'works'|'listings'|'lost'|'contacts'|'faqs'|'statuses';
export interface Settings { rules: string; blockedDates: string[]; openingBalance: number; seedDate: string }
export type DemoData = Record<Collection, Entity[]> & { messages: Message[]; settings: Settings };
