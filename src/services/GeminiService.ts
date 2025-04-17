
import { ExcelData } from "./ExcelService";
import { GeminiResponse, AgentState } from "./types/gemini-types";
import { AgentStateManager } from "./agents/AgentStateManager";
import { GeminiApiClient } from "./apis/GeminiApiClient";
import { ExcelOperationProcessor } from "./operations/ExcelOperationProcessor";

export { GeminiResponse, AgentState } from "./types/gemini-types";

export class GeminiService {
  private static FIRECRAWL_API_KEY = "fc-eb885ba004f340d7b5f7e9ee96a6d8d1";
  private static MAX_AGENT_ITERATIONS = 5;

  static getCurrentAgentState(): AgentState {
    return AgentStateManager.getCurrentAgentState();
  }

  static resetAgentState() {
    AgentStateManager.resetAgentState();
  }

  static async processQuery(prompt: string): Promise<GeminiResponse> {
    const currentAgentState = AgentStateManager.getCurrentAgentState();
    
    if (currentAgentState.status === 'idle' || currentAgentState.originalQuery !== prompt) {
      this.resetAgentState();
      AgentStateManager.setOriginalQuery(prompt);
    }

    AgentStateManager.updateAgentStatus('planning');
    AgentStateManager.updateAgentThinking("Analyzing your request and planning the approach...");

    try {
      console.log("Calling Gemini API with prompt:", prompt.substring(0, 100) + "...");
      
      const planningResponse = await GeminiApiClient.callGeminiAPI(`
        You are ExcelBot, an AI assistant specialized in working with Excel spreadsheets.
        First, analyze this user request and break it down into a series of concrete steps:
        "${prompt}"
        
        Format your response like this:
        PLAN:
        1. [First step description - be very specific and actionable]
        2. [Second step description - be very specific and actionable]
        ...
        
        REASONING:
        [Explain your approach]
        
        For each step, be specific about what Excel operations will be needed:
        - Cell updates (e.g., "Update cell A1 with header 'Sales'")
        - Formulas (e.g., "Add SUM formula in B10 to total values in B1:B9")
        - Charts (e.g., "Create bar chart showing monthly sales data")
        - Data transformations (e.g., "Sort column B in descending order")
        
        Each step must be concrete and executable, not vague.
      `);

      if (planningResponse.isError) {
        return planningResponse;
      }

      const planMatch = planningResponse.text.match(/PLAN:([\s\S]*?)(?:REASONING:|$)/);
      const plan = planMatch ? planMatch[1].trim() : "";
      
      const steps = plan.split(/\d+\./).filter(Boolean).map(step => ({
        description: step.trim(),
        completed: false,
        result: ""
      }));
      
      AgentStateManager.setSteps(steps);
      AgentStateManager.updateAgentStatus('executing');
      AgentStateManager.updateAgentThinking("Executing the plan step by step...");

      let finalResponse: GeminiResponse = { text: "", isError: false };
      
      for (let i = 0; i < Math.min(steps.length, this.MAX_AGENT_ITERATIONS); i++) {
        const step = steps[i];
        AgentStateManager.updateAgentThinking(`Working on step ${i+1}: ${step.description}`);
        console.log(`Executing step ${i+1}:`, step.description);
        
        const previousStepsContext = steps.slice(0, i)
          .filter(s => s.completed && s.result)
          .map((s, idx) => `Step ${idx+1} result: ${s.result}`)
          .join("\n");
        
        const stepPrompt = `
          Excel task: "${prompt}"
          
          Current step (${i+1}/${steps.length}): "${step.description}"
          ${previousStepsContext ? `\nPrevious steps results:\n${previousStepsContext}` : ''}
          
          Please implement this specific Excel operation in detail. Your response must include structured operations in this format:
          EXCEL_OPERATION_START
          {
            "type": "update_cell | add_formula | create_chart | sort | filter",
            "data": {
              // For update_cell: { row: number, col: number, value: any }
              // For add_formula: { row: number, col: number, formula: string with = prefix }
              // For create_chart: { chartType: "bar|line|pie|radar", title: string, data: [{name: string, value: number}, ...] }
              // For sort: { column: "A" or number }
              // For filter: { column: "A" or number, value: any }
            }
          }
          EXCEL_OPERATION_END
          
          Be very explicit and provide the exact data that should be used. If you need to create data, include that exact data in the operation.
          
          IMPORTANT: 
          - If working with data, ALWAYS specify EXACT cell locations (row, col values)
          - When generating data, make sure to specify enough rows/columns of data (not just one example)
          - Ensure that columns or rows you reference exist in the spreadsheet
          - For chart data, provide at least 5 data points with realistic values
          - Be careful not to overwrite existing important data - check the sheet structure first
          
          For example, if setting up a sales table, don't just say "Set up sales data" - instead provide the EXACT cells, values, and formulas needed.
          
          After the operation JSON block, explain what you did and why.
        `;
        
        const stepResponse = await GeminiApiClient.callGeminiAPI(stepPrompt);
        
        if (stepResponse.isError) {
          step.completed = false;
          if (step.result !== undefined) {
            step.result = `Error: ${stepResponse.text}`;
          }
          break;
        }
        
        AgentStateManager.completeStep(i);
        
        if (stepResponse.excelOperation && stepResponse.excelOperation.type) {
          const operationType = stepResponse.excelOperation.type;
          let operationSummary = "";
          
          switch (operationType) {
            case "update_cell":
              const cell = stepResponse.excelOperation.data;
              const cellRef = cell ? `${String.fromCharCode(65 + cell.col)}${cell.row + 1}` : "unknown";
              const cellValue = cell ? (typeof cell.value === 'object' ? JSON.stringify(cell.value).substring(0, 30) : String(cell.value).substring(0, 30)) : "unknown";
              operationSummary = `Updated cell ${cellRef} with value: ${cellValue}${cellValue.length > 30 ? '...' : ''}`;
              break;
              
            case "add_formula":
              const formula = stepResponse.excelOperation.data;
              const formulaRef = formula ? `${String.fromCharCode(65 + formula.col)}${formula.row + 1}` : "unknown";
              operationSummary = `Added formula ${formula ? formula.formula : ''} to cell ${formulaRef}`;
              break;
              
            case "create_chart":
              const chart = stepResponse.excelOperation.data;
              operationSummary = `Created ${chart ? chart.chartType : 'unknown'} chart: ${chart ? chart.title : ''}`;
              break;
              
            case "sort":
              const sort = stepResponse.excelOperation.data;
              operationSummary = `Sorted data by column ${sort ? sort.column : 'unknown'}`;
              break;
              
            case "filter":
              const filter = stepResponse.excelOperation.data;
              operationSummary = `Filtered data in column ${filter ? filter.column : 'unknown'} for "${filter ? filter.value : 'unknown'}"`;
              break;
              
            default:
              operationSummary = `Performed ${operationType} operation`;
          }
          
          AgentStateManager.updateStepResult(i, operationSummary);
        } else {
          AgentStateManager.updateStepResult(i, stepResponse.text.substring(0, 100) + "...");
        }
        
        console.log(`Step ${i+1} completed:`, steps[i].result);
        finalResponse = stepResponse;
      }
      
      AgentStateManager.updateAgentStatus('complete');
      return finalResponse;
    } catch (error) {
      console.error("Error in processQuery:", error);
      AgentStateManager.updateAgentStatus('complete');
      return { 
        text: "Sorry, I encountered an error while processing your request. Please try a simpler query or check your internet connection.", 
        isError: true 
      };
    }
  }

  static async processExcelOperation(operation: string, currentData: ExcelData): Promise<GeminiResponse> {
    return ExcelOperationProcessor.processExcelOperation(operation, currentData);
  }
}
