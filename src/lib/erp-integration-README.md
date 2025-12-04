# ERP System Integration

This integration allows you to fetch and compare data from your ERP system with the local alumni database.

## Configuration

Add the following to your `.env.local` file:

```env
ERP_API_URL=http://uolerp.uol.edu.pk:8000/sap/opu/odata/sap/ZSTUDENTHMIS_SRV/studentSet()
ERP_USERNAME=your_username
ERP_PASSWORD=your_password
ERP_API_TIMEOUT=30000
```

**Note:** The `ERP_API_URL` should include the full OData endpoint path ending with `studentSet()`.

## API Endpoints

### 1. Fetch Data from ERP
```
GET /api/erp/fetch?sapid=YOUR_SAP_ID
GET /api/erp/fetch?registrationno=YOUR_REG_NO
```

### 2. Compare ERP Data with Local Database
```
GET /api/erp/compare?sapid=YOUR_SAP_ID
GET /api/erp/compare?registrationno=YOUR_REG_NO
```

## Usage Examples

### Compare a specific alumni record:
```bash
# Using SAP ID
curl http://localhost:3000/api/erp/compare?sapid=12345

# Using Registration Number
curl http://localhost:3000/api/erp/compare?registrationno=REG123
```

### Fetch data from ERP only:
```bash
curl http://localhost:3000/api/erp/fetch?sapid=12345
```

### Discover ERP field names (if you get "Property not found" errors):
```bash
# Get a sample record to see available fields
curl http://localhost:3000/api/erp/discover?type=sample

# Get metadata (XML format)
curl http://localhost:3000/api/erp/discover?type=metadata
```

**Note:** If you encounter errors like "Property sapid not found in type student", use the discover endpoint to find the correct field names in your ERP system. The system will automatically try multiple field name variations, but you may need to update the field names in `src/lib/erpClient.ts` if they differ significantly.

## Response Format

### Compare Endpoint Response:
```json
{
  "success": true,
  "sapid": "12345",
  "registrationno": "REG123",
  "status": "match" | "mismatch" | "missing_in_local" | "missing_in_erp",
  "differences": [
    {
      "field": "alumniname",
      "localValue": "John Doe",
      "erpValue": "John D. Doe"
    }
  ],
  "localRecord": { ... },
  "erpRecord": { ... },
  "message": "Found 1 difference(s)"
}
```

## OData Query Format

The integration uses OData query syntax to filter records:

- **By SAP ID:** `studentSet()?$filter=sapid eq '12345'`
- **By Registration Number:** `studentSet()?$filter=registrationno eq 'REG123'`

The system will try multiple OData query formats automatically if one fails.

## Customization

### Adjust Authentication Method

If your ERP uses token-based authentication instead of Basic Auth, modify `src/lib/erpClient.ts`:

1. Uncomment the token-based authentication code in the `authenticate()` method
2. Adjust the endpoint and request format based on your ERP's API

### Map ERP Fields to Local Fields

Edit `src/lib/erpComparison.ts` and update the `mapErpFieldToLocal()` function to match your ERP's field names:

```typescript
const fieldMap: Record<string, string> = {
  "erp_field_name": "local_field_name",
  // Add your mappings here
};
```

### OData Response Format

The integration automatically handles OData response format:
- `{ "d": { "results": [...] } }` - Collection response
- `{ "d": { ... } }` - Single entity response

If your ERP returns a different format, adjust the response parsing in `src/lib/erpClient.ts` in the `request()` method.

## Notes

- Only admins and superadmins can access these endpoints
- The integration uses Basic Authentication by default
- Timeout is set to 30 seconds (configurable via `ERP_API_TIMEOUT`)
- All API calls are logged for debugging

