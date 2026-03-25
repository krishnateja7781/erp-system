// ============================================================
// Chatbot shared type definitions
// Each role has its own intent/service/formatter — types are shared
// because they define the CONTRACT, not the logic.
// ============================================================

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  success: boolean;
  role: 'student' | 'teacher' | 'super_admin' | 'employee';
  intent: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface ChatError {
  success: false;
  role: 'student' | 'teacher' | 'super_admin' | 'employee';
  intent: 'Error';
  message: string;
  metadata: {};
}

// Intent detection result
export interface DetectedIntent {
  intent: string;
  confidence: 'exact' | 'partial';
}
