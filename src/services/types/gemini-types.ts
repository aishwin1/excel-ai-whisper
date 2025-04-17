
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

export interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

export interface ChartOperation {
  chartType: "bar" | "line" | "pie" | "radar";
  title: string;
  data: ChartData[];
}
