# 🌍 ISDA Soil MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Railway](https://railway.app/button.svg)](https://railway.app)

**Model Context Protocol (MCP) server providing comprehensive soil property data and analysis for African locations.**

Integrates with the [ISDA Soil API](https://api.isda-africa.com/isdasoil/v2/docs) to deliver soil intelligence including pH, nutrients, texture, organic matter, and physical properties. Designed for integration with AI agents via OpenAI Agent Builder to provide farmers with actionable soil insights for agricultural planning.

## 🌟 Features

- **Soil Property Data**: Get comprehensive soil analysis including pH, nitrogen, phosphorus, potassium, carbon, texture, and more
- **Multiple Depths**: Supports soil data for 0-20cm and 20-50cm depths
- **Uncertainty Intervals**: Returns confidence intervals (50%, 68%, 90%) for all soil properties
- **African Coverage**: Soil data specifically for African locations
- **MCP Protocol**: Full Model Context Protocol implementation for AI agent integration
- **Production Ready**: Input validation, timeout handling, error handling, graceful shutdown, automatic token refresh

## 🛠️ Tools

The server exposes **2 MCP tools**:

| Tool | Purpose |
|------|---------|
| `get_isda_soil_properties` | Get comprehensive soil property data for a specific location including chemical properties (pH, nitrogen, phosphorus, potassium), physical properties (texture, bulk density), nutrient availability, and uncertainty intervals for multiple soil depths (0-20cm, 20-50cm) |
| `get_isda_available_layers` | Get metadata about all available soil properties/layers including descriptions, units, themes, and available depths |

### Available Soil Properties (32+)

**Chemical Properties:**
- pH, Nitrogen (total), Phosphorus, Potassium, Magnesium, Calcium
- Iron, Zinc, Sulphur (all extractable forms)
- Carbon (total, organic), Cation Exchange Capacity

**Physical Properties:**
- Bulk Density, Bedrock Depth, Stone Content
- Texture Class (USDA classification)
- Silt/Clay/Sand Content

**Land Cover & Agronomy:**
- Land Cover (2015-2019), Crop Cover (2015-2019)
- Slope Angle, FCC (Fertility Capability Classification)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- ISDA Soil API credentials (provided)

### Installation

```bash
npm install
npm run build
```

### Environment Variables

Create a `.env` file:

```bash
ISDA_USERNAME=***REMOVED***
ISDA_PASSWORD=***REMOVED***
ISDA_API_BASE_URL=https://api.isda-africa.com  # Optional, defaults to this
PORT=3002  # Optional, defaults to 3002
ALLOWED_ORIGINS=https://yourdomain.com  # Optional, defaults to *
```

### Running Locally

```bash
npm start
```

The server will start on `http://localhost:3002` (or the port specified in `PORT`).

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

Returns server status and configuration.

### Server Information
```bash
GET /
```

Returns server metadata and available tools.

### MCP Protocol Endpoint
```bash
POST /mcp
```

Main MCP protocol endpoint for tool calls. Accepts JSON-RPC 2.0 requests.

## 🔌 MCP Protocol

The server implements the Model Context Protocol (MCP) for AI agent integration.

### Custom Headers

- `X-Farm-Latitude`: Default latitude if not provided in tool parameters
- `X-Farm-Longitude`: Default longitude if not provided in tool parameters

These headers allow the chat widget to pass default coordinates that tools can use if coordinates are not explicitly provided in the tool call.

## 📋 Example Usage

### Get Soil Properties

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_isda_soil_properties",
    "arguments": {
      "latitude": -1.2864,
      "longitude": 36.8172,
      "depth": "0-20"
    }
  }
}
```

### Get Available Layers

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_isda_available_layers",
    "arguments": {}
  }
}
```

## 🚂 Railway Deployment

### Step 1: Create Railway Project

1. Go to [Railway](https://railway.app)
2. Create a new project
3. Connect your GitHub repository

### Step 2: Set Environment Variables

In Railway dashboard, add:
- `ISDA_USERNAME`: `***REMOVED***`
- `ISDA_PASSWORD`: `***REMOVED***`
- `PORT`: (Optional) Server port (defaults to 3002)

### Step 3: Deploy

Railway will automatically:
1. Detect Node.js project
2. Run `npm install`
3. Run `npm run build`
4. Start server with `npm start`

The `railway.json` file configures the build and deployment process.

## 🔧 Technical Features

- ✅ **JWT Authentication**: Automatic token refresh with JWT expiry decoding
- ✅ **Input Validation**: Validates latitude (-90 to 90, exclusive), longitude (-180 to 180, exclusive), and depth parameters
- ✅ **Timeout Protection**: 30-second timeout for all ISDA Soil API requests (prevents hanging)
- ✅ **Error Handling**: Comprehensive error messages with automatic retry on 401 errors
- ✅ **Graceful Shutdown**: Handles SIGTERM and SIGINT signals cleanly
- ✅ **Response Validation**: Validates ISDA Soil API response structure
- ✅ **TypeScript**: Full type safety with TypeScript
- ✅ **Token Caching**: JWT tokens cached and refreshed proactively (1 minute before expiry)
- ✅ **StreamableHTTP MCP Transport**: Full Model Context Protocol implementation

## 📊 Response Format

### Soil Properties Response

```json
{
  "location": {
    "latitude": -1.2864,
    "longitude": 36.8172
  },
  "depth_filter": "all",
  "properties": {
    "ph": [
      {
        "value": {
          "unit": null,
          "type": "float",
          "value": 6.7
        },
        "depth": {
          "value": "0-20",
          "unit": "cm"
        },
        "uncertainty": [
          {
            "confidence_interval": "50%",
            "lower_bound": 6.6,
            "upper_bound": 6.8
          }
        ]
      }
    ]
  },
  "data_source": "ISDA Soil API",
  "note": "Soil properties include uncertainty intervals at 50%, 68%, and 90% confidence levels"
}
```

## 🌍 Geographic Coverage

**IMPORTANT:** This MCP server provides soil data **ONLY for African countries** via the ISDA Soil API.

### ✅ Available Countries (Africa Only)

The ISDA Soil API has been tested and confirmed to work for **all African countries**, including but not limited to:

**West Africa:**
- Nigeria, Ghana, Senegal, Mali, Burkina Faso, Niger, Cameroon, Côte d'Ivoire

**East Africa:**
- Ethiopia, Kenya, Tanzania, Uganda, Sudan, Egypt

**Southern Africa:**
- South Africa, Zimbabwe, Zambia, Malawi, Mozambique, Angola, Botswana, Madagascar

**North Africa:**
- Morocco, Algeria, Egypt

### ❌ Not Available

**All countries outside Africa** return HTTP 400 with the message: *"Please choose another location. We don't have soil data"*

Tested and confirmed **not available**:
- **Asia:** India, Vietnam, Indonesia, Thailand, Philippines
- **Americas:** Brazil, Mexico, USA
- **Europe:** UK, France, Spain (including Canary Islands)
- **Oceania:** Australia

### Coverage Verification

The API name "ISDA" (Innovative Solutions for Digital Agriculture) and domain `isda-africa.com` confirm this is an **Africa-specific** service. All tested African locations returned 32+ soil properties successfully, while non-African locations returned clear error messages indicating no data availability.

## 🔗 Integration with OpenAI Agent Builder

This server is designed to work with OpenAI Agent Builder alongside other MCP servers:

1. **GAP MCP Server**: Weather for Kenya/East Africa
2. **SSFR MCP Server**: Fertilizer recommendations for Ethiopia
3. **AccuWeather MCP Server**: Weather for Ethiopia and global locations
4. **ISDA Soil MCP Server** (this server): Soil data for African locations

### Configuration in Agent Builder

1. Go to **Integrations** → **MCP Servers**
2. Add new MCP server:
   - **Name:** `isda-soil-mcp`
   - **URL:** `https://isda-soil-mcp-server.up.railway.app/mcp`
3. Enable tools in your Agent:
   - ✅ `get_isda_soil_properties`
   - ✅ `get_isda_available_layers`

## 📝 Project Structure

```
isda-soil-mcp-server/
├── src/
│   ├── index.ts              # Main server file
│   └── isda-soil-client.ts   # ISDA Soil API client
├── dist/                      # Compiled JavaScript (generated, gitignored)
├── package.json
├── tsconfig.json
├── railway.json              # Railway deployment config
├── .gitignore
└── README.md
```

## 🔒 Security

- API credentials are read from environment variables only
- Never commit credentials to git
- `.env` files are excluded via `.gitignore`
- CORS can be configured via `ALLOWED_ORIGINS` environment variable
- JWT tokens are cached securely and refreshed automatically

## 📚 Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `express`: Web server framework
- `cors`: Cross-origin resource sharing
- `node-fetch`: HTTP client for API requests
- `zod`: Schema validation
- `dotenv`: Environment variable management

## 🐛 Troubleshooting

### Authentication Issues

If you get 401 Unauthorized:
- Verify username and password are correct
- Check that environment variables are set correctly
- Token expires after 1 hour - the server automatically refreshes tokens

### API Errors

If you get API errors:
- Verify coordinates are valid (exclusive bounds: -90 < lat < 90, -180 < lon < 180)
- Check if location is within ISDA Soil API coverage area (Africa)
- Verify depth parameter is either "0-20" or "20-50" if provided

### Build Errors

If TypeScript build fails:
- Ensure Node.js 18+ is installed
- Run `npm install` to ensure all dependencies are installed
- Check TypeScript version compatibility

## 📄 License

MIT

## 🔗 Related Projects

- [GAP Agriculture MCP Server](../gap-mcp-server) - Weather for Kenya/East Africa
- [SSFR MCP Server](../ssfr-mcp-server) - Fertilizer recommendations for Ethiopia
- [AccuWeather MCP Server](../accuweather-mcp-server) - Weather for Ethiopia and global locations
- [GAP Chat Widget](../gap-chat-widget) - Frontend chat interface

## 🤝 Contributing

This is a private project. For issues or questions, contact the repository owner.

## 📖 ISDA Soil API Documentation

- API Documentation: https://api.isda-africa.com/isdasoil/v2/docs
- OpenAPI Spec: https://api.isda-africa.com/isdasoil/v2/openapi.json
- Registration: https://www.isda-africa.com/api/registration

