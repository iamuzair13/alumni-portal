/**
 * ERP System API Client
 * Handles authentication and data fetching from the external ERP system
 */

type ErpConfig = {
  apiUrl: string;
  username: string;
  password: string;
  timeout?: number;
};

type ErpApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

class ErpApiClient {
  private config: ErpConfig;
  private authToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      apiUrl: process.env.ERP_API_URL || "",
      username: process.env.ERP_USERNAME || "",
      password: process.env.ERP_PASSWORD || "",
      timeout: parseInt(process.env.ERP_API_TIMEOUT || "30000", 10),
    };

    if (!this.config.apiUrl || !this.config.username || !this.config.password) {
      const missing = [];
      if (!this.config.apiUrl) missing.push("ERP_API_URL");
      if (!this.config.username) missing.push("ERP_USERNAME");
      if (!this.config.password) missing.push("ERP_PASSWORD");
      console.error(`[ERP Client] Missing ERP configuration: ${missing.join(", ")}`);
      // Don't throw in constructor - let methods handle it gracefully
      console.warn("[ERP Client] ERP client initialized but configuration is incomplete. API calls will fail.");
    } else {
      console.log("[ERP Client] Initialized with API URL:", this.config.apiUrl.replace(/\/studentSet\(\)$/, ""));
    }
  }

  /**
   * Authenticate with ERP system using Basic Authentication
   * Adjust this based on your ERP's authentication method
   */
  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.authToken && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }

    try {
      // Create Basic Auth header
      const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      
      // Try to authenticate - adjust endpoint based on your ERP
      // If your ERP uses token-based auth, uncomment and adjust below:
      /*
      const response = await fetch(`${this.config.apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`ERP Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.authToken = data.token || data.access_token || data.data?.token;
      this.tokenExpiry = Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600000);
      */

      // For Basic Auth, we'll use the credentials directly
      this.authToken = credentials;
      this.tokenExpiry = Date.now() + 3600000; // 1 hour

      return this.authToken;
    } catch (error) {
      console.error("[ERP Client] Authentication error:", error);
      throw new Error(`Failed to authenticate with ERP system: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Make an authenticated request to the ERP API
   */
  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ErpApiResponse<T>> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const requestStartTime = Date.now();
    
    // Check configuration before making request
    if (!this.config.apiUrl || !this.config.username || !this.config.password) {
      const missing = [];
      if (!this.config.apiUrl) missing.push("ERP_API_URL");
      if (!this.config.username) missing.push("ERP_USERNAME");
      if (!this.config.password) missing.push("ERP_PASSWORD");
      console.error(`[ERP Client ${requestId}] Missing configuration:`, missing);
      return {
        success: false,
        error: `Missing ERP configuration: ${missing.join(", ")}`,
      };
    }
    
    try {
      const token = await this.authenticate();

      // Handle OData endpoint - construct the full URL
      // Base URL format: http://uolerp.uol.edu.pk:8000/sap/opu/odata/sap/ZSTUDENTHMIS_SRV/
      let url: string;
      if (endpoint.startsWith("http")) {
        url = endpoint;
      } else {
        // Base URL no longer includes studentSet(), so we append it
        const baseUrl = this.config.apiUrl.trim();
        // Ensure base URL ends with / for proper concatenation
        const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
        
        if (endpoint.startsWith("studentSet(")) {
          // Key-based lookup format: studentSet('1234567') or studentSet("1234567")
          // Append to base URL: baseUrl/studentSet('identifier')
          url = `${normalizedBaseUrl}${endpoint}`;
          console.log(`[ERP Client ${requestId}] Constructed URL (key-based): ${url}`);
        } else if (endpoint.startsWith("studentSet()")) {
          // OData query format: studentSet()?$filter=...
          // Append to base URL: baseUrl/studentSet()?$filter=...
          url = `${normalizedBaseUrl}${endpoint}`;
          console.log(`[ERP Client ${requestId}] Constructed URL (query): ${url}`);
        } else if (endpoint.startsWith("/")) {
          url = `${normalizedBaseUrl}${endpoint.slice(1)}`; // Remove leading / to avoid double slashes
        } else {
          url = `${normalizedBaseUrl}${endpoint}`;
        }
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, application/xml, text/xml, application/atom+xml", // Accept both JSON and XML
          "Authorization": `Basic ${token}`, // Using Basic Auth
          ...options.headers,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        // Handle 404 (Not Found) as a special case - record doesn't exist
        if (response.status === 404) {
          return {
            success: false,
            error: "NOT_FOUND",
            message: "No record found in ERP system",
          };
        }
        
        const errorText = await response.text().catch(() => "");
        
        // Also check if the error message indicates "not found" or "does not exist"
        const lowerErrorText = errorText.toLowerCase();
        if (lowerErrorText.includes("not found") || 
            lowerErrorText.includes("does not exist") || 
            lowerErrorText.includes("no record") ||
            lowerErrorText.includes("record not found")) {
          return {
            success: false,
            error: "NOT_FOUND",
            message: "No record found in ERP system",
          };
        }
        let errorMessage = errorText;
        
        // Try to parse OData error format (JSON or XML)
        try {
          // Check if it's XML
          if (errorText.trim().startsWith("<?xml") || errorText.trim().startsWith("<error")) {
            // Parse XML error
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(errorText, "text/xml");
            const messageElement = xmlDoc.querySelector("message");
            const codeElement = xmlDoc.querySelector("code");
            
            if (messageElement) {
              errorMessage = messageElement.textContent || errorText;
            } else if (codeElement) {
              errorMessage = codeElement.textContent || errorText;
            }
          } else {
            // Try JSON
            const errorJson = JSON.parse(errorText);
            const odataError = errorJson.error || errorJson;
            errorMessage = odataError.message?.value || odataError.message || errorText;
          }
        } catch {
          // If parsing fails, use the raw error text
          errorMessage = errorText;
        }
        
        throw new Error(`ERP API error: ${response.status} ${response.statusText} - ${errorMessage}`);
      }

      // Check content type to determine if response is JSON or XML
      const contentType = response.headers.get("content-type") || "";
      let resultData: T;
      
      // Read response as text first to check if it's XML
      const responseText = await response.text();
      const isXml = responseText.trim().startsWith("<?xml") || responseText.trim().startsWith("<entry") || responseText.trim().startsWith("<feed");
      
      if (isXml || contentType.includes("application/xml") || contentType.includes("text/xml") || contentType.includes("application/atom+xml")) {
        // XML response - parse OData Atom XML format
        try {
          // Parse XML using DOMParser
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(responseText, "text/xml");
          
          // Check for parse errors
          const parseError = xmlDoc.querySelector("parsererror");
          if (parseError) {
            throw new Error("XML parse error");
          }
          
          // Extract data from OData Atom format
          // OData Atom format: <entry><content type="application/xml"><m:properties>...</m:properties></content></entry>
          // Try different namespace variations and selectors
          let propertiesElement: Element | null = null;
          
          // Try various selectors for properties element
          const selectors = [
            "properties",
            "m\\:properties",
            "d\\:properties",
            "*[local-name()='properties']",
            "content > properties",
            "content > m\\:properties",
            "content > d\\:properties",
            "entry > content > properties",
            "entry > content > m\\:properties",
            "entry > content > d\\:properties",
          ];
          
          for (const selector of selectors) {
            try {
              propertiesElement = xmlDoc.querySelector(selector);
              if (propertiesElement) {
                console.log(`[ERP Client] Found properties element using selector: ${selector}`);
                break;
              }
            } catch {
              // Invalid selector, try next
              continue;
            }
          }
          
          // If still not found, try getting all elements with local name 'properties'
          if (!propertiesElement) {
            const allElements = xmlDoc.getElementsByTagName("*");
            for (let i = 0; i < allElements.length; i++) {
              const elem = allElements[i];
              if (elem.localName === "properties" || elem.tagName.endsWith(":properties")) {
                propertiesElement = elem;
                console.log(`[ERP Client] Found properties element by iterating: ${elem.tagName}`);
                break;
              }
            }
          }
          
          if (propertiesElement) {
            // Convert XML properties to object
            const dataObj: Record<string, unknown> = {};
            
            // Get all child elements (properties)
            const children = Array.from(propertiesElement.children);
            
            console.log(`[ERP Client] Found ${children.length} property elements`);
            
            for (const child of children) {
              // Remove namespace prefix from tag name
              const tagName = child.localName || child.tagName.replace(/^[^:]+:/, "");
              const textContent = child.textContent?.trim() || "";
              
              // Try to parse as number if it looks like a number
              if (textContent && /^-?\d+(\.\d+)?$/.test(textContent)) {
                dataObj[tagName] = parseFloat(textContent);
              } else if (textContent === "true" || textContent === "false") {
                dataObj[tagName] = textContent === "true";
              } else if (textContent === "") {
                dataObj[tagName] = null;
              } else {
                dataObj[tagName] = textContent;
              }
              
              console.log(`[ERP Client] Extracted field: ${tagName} = ${textContent.substring(0, 50)}`);
            }
            
            resultData = dataObj as T;
            const fieldCount = Object.keys(dataObj).length;
            console.log(`[ERP Client ${requestId}] Successfully parsed OData Atom XML response:`, {
              fieldCount,
              fields: Object.keys(dataObj).slice(0, 20), // Log first 20 fields
              sampleValues: Object.entries(dataObj).slice(0, 5).map(([k, v]) => ({ [k]: String(v).substring(0, 50) })),
            });
          } else {
            // If no properties found, log the XML structure for debugging
            console.warn("[ERP Client] XML response but no properties element found");
            console.warn("[ERP Client] XML structure:", responseText.substring(0, 1000));
            
            // Try to extract any data from the XML as fallback
            const allElements = xmlDoc.getElementsByTagName("*");
            const dataObj: Record<string, unknown> = {};
            
            for (let i = 0; i < allElements.length; i++) {
              const elem = allElements[i];
              const tagName = elem.localName || elem.tagName.replace(/^[^:]+:/, "");
              const textContent = elem.textContent?.trim() || "";
              
              // Skip if it's a structural element or empty
              if (["entry", "content", "properties", "id", "title", "updated", "category", "link"].includes(tagName.toLowerCase()) || !textContent) {
                continue;
              }
              
              // Only add if it looks like actual data (not XML structure)
              if (textContent && textContent.length > 0 && !textContent.includes("http://") && !textContent.includes("xmlns")) {
                dataObj[tagName] = textContent;
              }
            }
            
            if (Object.keys(dataObj).length > 0) {
              resultData = dataObj as T;
              console.log("[ERP Client] Extracted data from XML structure:", Object.keys(dataObj));
            } else {
              resultData = responseText as T;
            }
          }
        } catch (parseError) {
          // If XML parsing fails, return as text
          console.error("[ERP Client] Failed to parse XML response:", parseError);
          resultData = responseText as T;
        }
      } else if (contentType.includes("application/json") || contentType.includes("text/json")) {
        // JSON response
        console.log(`[ERP Client ${requestId}] Detected JSON response, parsing...`);
        try {
          const parseJsonStart = Date.now();
          const data = JSON.parse(responseText);
          const parseJsonDuration = Date.now() - parseJsonStart;
          
          console.log(`[ERP Client ${requestId}] JSON parsed in ${parseJsonDuration}ms:`, {
            hasD: !!data.d,
            hasResults: !!(data.d?.results),
            hasData: !!data.data,
            topLevelKeys: Object.keys(data).slice(0, 10),
          });
          
          // Handle OData response format
          // OData typically returns: { "d": { "results": [...] } } or { "d": { ... } }
          let extractedData: unknown = data;
          if (data.d) {
            // OData format - extract the data
            extractedData = data.d.results || data.d;
            console.log(`[ERP Client ${requestId}] Extracted OData format:`, {
              isArray: Array.isArray(extractedData),
              isObject: typeof extractedData === "object",
              keys: extractedData && typeof extractedData === "object" && !Array.isArray(extractedData) 
                ? Object.keys(extractedData).slice(0, 10) 
                : null,
            });
          } else if (data.data) {
            // Alternative format
            extractedData = data.data;
            console.log(`[ERP Client ${requestId}] Extracted alternative format`);
          }
          resultData = extractedData as T;
        } catch (parseError) {
          console.error(`[ERP Client ${requestId}] JSON parse error:`, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            textPreview: responseText.substring(0, 500),
          });
          resultData = responseText as T;
        }
      } else {
        // Try to parse as JSON first, fallback to text
        try {
          const parsed = JSON.parse(responseText);
          // Handle OData format if it's JSON
          let extractedData: unknown = parsed;
          if (parsed && typeof parsed === "object" && "d" in parsed) {
            extractedData = (parsed as { d: { results?: unknown; [key: string]: unknown } }).d.results || (parsed as { d: unknown }).d;
          }
          resultData = extractedData as T;
        } catch {
          resultData = responseText as T;
        }
      }
      
      const totalRequestDuration = Date.now() - requestStartTime;
      const finalDataSize = resultData && typeof resultData === "object" 
        ? JSON.stringify(resultData).length 
        : String(resultData).length;
      
      console.log(`[ERP Client ${requestId}] Request completed successfully in ${totalRequestDuration}ms:`, {
        dataSize: finalDataSize,
        dataType: typeof resultData,
        isArray: Array.isArray(resultData),
        keys: resultData && typeof resultData === "object" && !Array.isArray(resultData)
          ? Object.keys(resultData).slice(0, 10)
          : null,
      });
      
      return {
        success: true,
        data: resultData,
      };
    } catch (error) {
      const totalRequestDuration = Date.now() - requestStartTime;
      console.error(`[ERP Client ${requestId}] Request error after ${totalRequestDuration}ms:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Log detailed error for debugging
      console.error(`[ERP Client ${requestId}] Request error details:`, {
        message: errorMessage,
        stack: errorStack,
        endpoint,
        duration: totalRequestDuration,
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch student/alumni data from ERP using SAP ID or Registration Number
   * Based on Postman testing, the working format is: studentSet('1234567')
   * This is a key-based lookup format, not a $filter query
   */
  async fetchStudentData(identifier: string): Promise<ErpApiResponse> {
    if (!identifier || !identifier.trim()) {
      return {
        success: false,
        error: "Identifier is required",
      };
    }

    const trimmedIdentifier = identifier.trim();
    
    // Based on Postman testing and error messages, the working format is: studentSet('identifier')
    // The key field is 'SapNo' (from error: "Invalid key predicate type for 'SapNo'")
    // But we use the identifier directly in the key-based lookup
    
    const fetchStartTime = Date.now();
    console.log(`[ERP Client] fetchStudentData started for identifier: ${trimmedIdentifier.substring(0, 10)}...`);
    
    // Try only the format that works in Postman first
    // Format: studentSet('1234567') with single quotes
    console.log(`[ERP Client] Attempting format: studentSet('${trimmedIdentifier}')`);
    const response = await this.request(`studentSet('${trimmedIdentifier}')`);
    
    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`[ERP Client] First attempt completed in ${fetchDuration}ms:`, {
      success: response.success,
      error: response.error,
      hasData: !!response.data,
    });
    
    if (response.success) {
      console.log(`[ERP Client] Successfully fetched data in ${fetchDuration}ms`);
      return response;
    }
    
    // If NOT_FOUND, return immediately (don't try other formats)
    if (response.error === "NOT_FOUND") {
      console.log(`[ERP Client] Record not found in ERP (${fetchDuration}ms)`);
      return response;
    }
    
    // If we get a clear error that indicates the format is wrong but record might exist,
    // try one alternative format with double quotes
    const lastError = response.error || "";
    if (lastError.includes("Malformed URI") || lastError.includes("Invalid key predicate")) {
      console.log(`[ERP Client] Trying alternative format: studentSet("${trimmedIdentifier}")`);
      const altStartTime = Date.now();
      const altResponse = await this.request(`studentSet("${trimmedIdentifier}")`);
      const altDuration = Date.now() - altStartTime;
      
      console.log(`[ERP Client] Alternative attempt completed in ${altDuration}ms:`, {
        success: altResponse.success,
        error: altResponse.error,
      });
      
      if (altResponse.success || altResponse.error === "NOT_FOUND") {
        return altResponse;
      }
    }
    
    const totalDuration = Date.now() - fetchStartTime;
    console.error(`[ERP Client] Failed to fetch data after ${totalDuration}ms:`, {
      error: response.error,
      message: response.message,
    });
    
    // If all formats fail, return the first error
    return response;
  }

  /**
   * Fetch student data by SAP ID
   */
  async fetchBySapId(sapId: string): Promise<ErpApiResponse> {
    return this.fetchStudentData(sapId);
  }

  /**
   * Fetch student data by Registration Number
   */
  async fetchByRegistrationNo(registrationNo: string): Promise<ErpApiResponse> {
    return this.fetchStudentData(registrationNo);
  }

  /**
   * Fetch metadata to discover available fields in the studentSet entity
   * This can help identify the correct field names
   */
  async fetchMetadata(): Promise<ErpApiResponse> {
    try {
      const baseUrl = this.config.apiUrl.trim();
      // Remove studentSet() from the end to get the service root
      const serviceRoot = baseUrl.replace(/\/studentSet\(\)$/, "");
      const metadataUrl = `${serviceRoot}/$metadata`;
      
      const token = await this.authenticate();
      
      const response = await fetch(metadataUrl, {
        headers: {
          "Content-Type": "application/xml",
          "Authorization": `Basic ${token}`,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return {
          success: false,
          error: `Failed to fetch metadata: ${response.status} ${response.statusText}`,
          message: errorText,
        };
      }

      const metadataXml = await response.text();
      return {
        success: true,
        data: metadataXml,
      };
    } catch (error) {
      console.error("[ERP Client] Metadata fetch error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch metadata",
      };
    }
  }

  /**
   * Fetch a sample record (first record) to see the structure and field names
   */
  async fetchSampleRecord(): Promise<ErpApiResponse> {
    try {
      const baseUrl = this.config.apiUrl.trim();
      const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      const sampleUrl = `${normalizedBaseUrl}studentSet()?$top=1`;
      
      const token = await this.authenticate();
      
      const response = await fetch(sampleUrl, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${token}`,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return {
          success: false,
          error: `Failed to fetch sample record: ${response.status} ${response.statusText}`,
          message: errorText,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      let resultData: unknown;
      
      if (contentType.includes("application/json") || contentType.includes("text/json")) {
        const data = await response.json();
        resultData = data;
        if (data.d) {
          resultData = data.d.results || data.d;
        } else if (data.data) {
          resultData = data.data;
        }
      } else {
        const text = await response.text();
        try {
          resultData = JSON.parse(text);
          if (resultData && typeof resultData === "object" && "d" in resultData) {
            resultData = (resultData as { d: { results?: unknown; [key: string]: unknown } }).d.results || (resultData as { d: unknown }).d;
          }
        } catch {
          resultData = text;
        }
      }
      
      return {
        success: true,
        data: resultData,
      };
    } catch (error) {
      console.error("[ERP Client] Sample record fetch error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch sample record",
      };
    }
  }
}

// Export singleton instance
export const erpClient = new ErpApiClient();

