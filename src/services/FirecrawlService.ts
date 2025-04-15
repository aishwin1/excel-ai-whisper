
interface CrawlResultItem {
  url: string;
  title: string;
  content: string;
}

interface CrawlResult {
  success: boolean;
  data?: CrawlResultItem[];
  error?: string;
}

export class FirecrawlService {
  private static API_KEY = "fc-eb885ba004f340d7b5f7e9ee96a6d8d1";
  private static API_URL = "https://api.firecrawl.dev/v1/crawl";

  static async fetchWebData(query: string): Promise<CrawlResult> {
    try {
      console.log("Fetching web data for:", query);
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
        },
        body: JSON.stringify({
          url: query,
          depth: 1,
          max_pages: 5
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Firecrawl API error status:", response.status, errorText);
        return { 
          success: false, 
          error: `Failed to fetch web data: ${response.statusText}` 
        };
      }

      const data = await response.json();
      
      if (!response.ok) {
        console.error("Firecrawl API error:", data);
        return { 
          success: false, 
          error: data.message || "Failed to fetch web data" 
        };
      }

      console.log("Firecrawl API success, results:", data.results?.length || 0);
      return { 
        success: true, 
        data: data.results || [] 
      };
    } catch (error) {
      console.error("Error calling Firecrawl API:", error);
      return { 
        success: false, 
        error: "An error occurred while fetching web data" 
      };
    }
  }

  static convertToExcelData(crawlResult: CrawlResultItem[]): any[][] {
    // Create header row
    const headers = ["URL", "Title", "Content Preview"];
    
    // Map the data to rows
    const rows = crawlResult.map(item => [
      item.url,
      item.title,
      item.content.substring(0, 200) + "..." // Preview of content
    ]);
    
    return [headers, ...rows];
  }
}
