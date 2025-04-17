
import { GeminiResponse } from "../types/gemini-types";
import { JsonExtractor } from "../utils/JsonExtractor";

export class GeminiApiClient {
  private static API_KEY = "AIzaSyDvHZ5PRJkxXyTHfjkBUMgrpOa_iFd1HGY";
  private static API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";
  
  static async callGeminiAPI(prompt: string): Promise<GeminiResponse> {
    try {
      const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are ExcelBot, an AI assistant specialized in helping users with Excel spreadsheets.
                  When working with Excel, provide clear formulas and operations that can be applied directly.
                  For calculations, use proper Excel formula syntax starting with '='.
                  
                  Always include structured operations in your responses using this format:
                  EXCEL_OPERATION_START
                  {
                    "type": "update_cell | add_formula | create_chart | sort | filter",
                    "data": {
                      // For update_cell: { row: number, col: number, value: any }
                      // For add_formula: { row: number, col: number, formula: string }
                      // For create_chart: { chartType: "bar|line|pie|radar", title: string, data: [{name: string, value: number}, ...] }
                      // For sort: { column: "A" or number }
                      // For filter: { column: "A" or number, value: any }
                    }
                  }
                  EXCEL_OPERATION_END
                  
                  IMPORTANT GUIDELINES FOR EXCEL OPERATIONS:
                  1. When updating cells or adding data:
                     - ALWAYS use 0-based row/column indices (first row is 0, first column is 0)
                     - Make sure to specify exact row/column numbers for ALL data
                     - Avoid using relative references or placeholders
                     - Provide complete data sets with clear organization
                     - A1 = row:0, col:0; B3 = row:2, col:1
                  
                  2. When working with charts:
                     - Always specify the chart type: bar, line, pie, or radar
                     - Provide a meaningful title for the chart
                     - ALWAYS provide the actual data points for the chart in the 'data' array
                     - Include at least 5 data points with realistic values
                     - Example:
                       "data": [
                         {"name": "January", "value": 200},
                         {"name": "February", "value": 350},
                         {"name": "March", "value": 400}
                       ]
                  
                  3. For formulas:
                     - Always use the '=' prefix (like =SUM(A1:A10))
                     - Make sure to provide sensible cell references
                     - Support formulas: SUM, AVERAGE, COUNT, MAX, MIN
                  
                  4. For sample data:
                     - Always provide SPECIFIC data, not placeholders
                     - Use realistic values for the user's task
                     - Make sure the data makes sense in the context of the task

                  Answer the following query about Excel: ${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API response not OK:", response.status, errorText);
        return { 
          text: `Sorry, I encountered an error while processing your request (Status: ${response.status}). Please try again with a different question.`, 
          isError: true 
        };
      }

      const data = await response.json();
      
      if (data.error) {
        console.error("Gemini API error:", data.error);
        return { 
          text: `Sorry, I encountered an error: ${data.error?.message || "Unknown error"}. Please try a different approach.`, 
          isError: true 
        };
      }

      console.log("Gemini API response received:", data);
      
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
      
      const excelOperation = JsonExtractor.extractExcelOperation(responseText);
      
      return { 
        text: responseText, 
        isError: false,
        excelOperation
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return { 
        text: "Sorry, I encountered an error while processing your request. Please try a simpler query or check your internet connection.", 
        isError: true 
      };
    }
  }
}
