import type { SupportMessage, SupportThread } from "@/lib/support/model";
export type MessengerSession = {
  authenticated: boolean;
  identity?: string;
  ai: boolean;
  chatId?: string | null;
  conversations: SupportThread[];
  idleSeconds: number;
  serverTime?: string;
  orders?: { id: string; status: string; items: { plan_name: string }[] }[];
};
export type ConversationDetail = {
  thread: SupportThread;
  messages: SupportMessage[];
  idleSeconds: number;
  serverTime?: string;
};
