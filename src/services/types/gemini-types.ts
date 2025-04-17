
import { ExcelData } from "../ExcelService";

export interface GeminiResponse {
  text: string;
  isError: boolean;
  excelOperation?: {
    type: string;
    data?: any;
  };
}

export interface AgentState {
  thinking: string;
  status: 'idle' | 'planning' | 'executing' | 'complete';
  steps: Array<{
    description: string;
    completed: boolean;
    result?: string;
  }>;
  originalQuery: string;
}
