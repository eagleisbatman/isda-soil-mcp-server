import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ISDASoilClient } from './isda-soil-client.js';

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  exposedHeaders: ['Mcp-Session-Id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id', 'Authorization', 'X-Farm-Latitude', 'X-Farm-Longitude']
}));

// Environment variables
const ISDA_USERNAME = process.env.ISDA_USERNAME || '';
const ISDA_PASSWORD = process.env.ISDA_PASSWORD || '';
const ISDA_API_BASE_URL = process.env.ISDA_API_BASE_URL || 'https://api.isda-africa.com';
const PORT = process.env.PORT || 3002;

// Warn if credentials are missing
if (!ISDA_USERNAME || !ISDA_PASSWORD) {
  console.warn('⚠️  WARNING: ISDA_USERNAME and ISDA_PASSWORD environment variables are not set!');
  console.warn('⚠️  Server will start but MCP tools will not work until credentials are configured.');
}

// Initialize ISDA Soil Client
const isdaSoilClient = (ISDA_USERNAME && ISDA_PASSWORD) 
  ? new ISDASoilClient({
      baseUrl: ISDA_API_BASE_URL,
      username: ISDA_USERNAME,
      password: ISDA_PASSWORD
    })
  : null;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'isda-soil-mcp-server',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    isdaApiConfigured: !!(ISDA_USERNAME && ISDA_PASSWORD)
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'ISDA Soil MCP Server',
    version: '1.0.0',
    description: 'Soil property data and analysis for African locations via ISDA Soil API',
    endpoints: {
      health: '/health',
      mcp: '/mcp (POST)'
    },
    tools: [
      'get_isda_soil_properties',
      'get_isda_available_layers'
    ]
  });
});

// Main MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    // Extract default coordinates from custom headers
    const headerLat = req.headers['x-farm-latitude'] as string;
    const headerLon = req.headers['x-farm-longitude'] as string;
    const defaultLatitude = headerLat ? parseFloat(headerLat) : undefined;
    const defaultLongitude = headerLon ? parseFloat(headerLon) : undefined;

    if (defaultLatitude && defaultLongitude) {
      console.log(`[MCP] Using default coordinates from headers: lat=${defaultLatitude}, lon=${defaultLongitude}`);
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined // Stateless
    });

    const server = new McpServer({
      name: 'isda-soil-intelligence',
      version: '1.0.0',
      description: 'Soil property data and analysis for African locations via ISDA Soil API'
    });

    // Tool: Get Soil Properties
    server.tool(
      'get_isda_soil_properties',
      'Get soil property data for a specific location. Returns soil properties including pH, nitrogen, phosphorus, potassium, and other chemical properties with values for different soil depths (0-20cm and 20-50cm). Includes uncertainty intervals for each property.',
      {
        latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate. Optional if provided in headers.'),
        longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate. Optional if provided in headers.'),
        depth: z.enum(['0-20', '20-50']).optional().describe('Optional soil depth filter. Default: returns both depths (0-20cm and 20-50cm).')
      },
      async ({ latitude, longitude, depth }) => {
        try {
          // Use header defaults if coordinates not provided, fallback to Nairobi
          const NAIROBI_LAT = -1.2864;
          const NAIROBI_LON = 36.8172;
          const lat = latitude ?? defaultLatitude ?? NAIROBI_LAT;
          const lon = longitude ?? defaultLongitude ?? NAIROBI_LON;

          console.log(`[MCP Tool] get_isda_soil_properties called: lat=${lat}, lon=${lon}, depth=${depth || 'all'}`);

          // Validate coordinates
          if (typeof lat !== 'number' || isNaN(lat) || lat <= -90 || lat >= 90) {
            return {
              content: [{
                type: 'text',
                text: 'Invalid latitude coordinate. Please provide a valid latitude between -90 and 90 (exclusive).'
              }],
              isError: true
            };
          }
          if (typeof lon !== 'number' || isNaN(lon) || lon <= -180 || lon >= 180) {
            return {
              content: [{
                type: 'text',
                text: 'Invalid longitude coordinate. Please provide a valid longitude between -180 and 180 (exclusive).'
              }],
              isError: true
            };
          }

          if (!isdaSoilClient) {
            return {
              content: [{
                type: 'text',
                text: 'I\'m having trouble connecting to the soil data service. Try again in a moment?'
              }],
              isError: true
            };
          }

          const data = await isdaSoilClient.getSoilPropertyData(lat, lon, depth);

          // Format response for agent analysis
          const response = {
            location: {
              latitude: lat,
              longitude: lon
            },
            depth_filter: depth || 'all',
            properties: data.property,
            data_source: 'ISDA Soil API',
            note: 'Soil properties include uncertainty intervals at 50%, 68%, and 90% confidence levels'
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }]
          };
        } catch (error: any) {
          console.error('[MCP Tool] Error in get_isda_soil_properties:', error);
          return {
            content: [{
              type: 'text',
              text: `I'm having trouble getting soil data right now. ${error.message || 'Try again in a moment?'}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool: Get Available Layers
    server.tool(
      'get_isda_available_layers',
      'Get metadata about available soil properties/layers. Returns information about all soil properties that can be queried, including descriptions, units, and available depths.',
      {},
      async () => {
        try {
          console.log(`[MCP Tool] get_isda_available_layers called`);

          if (!isdaSoilClient) {
            return {
              content: [{
                type: 'text',
                text: 'I\'m having trouble connecting to the soil data service. Try again in a moment?'
              }],
              isError: true
            };
          }

          const data = await isdaSoilClient.getAvailableLayers();

          const response = {
            available_properties: data.property,
            data_source: 'ISDA Soil API',
            note: 'Use these property names when querying soil data'
          };

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }]
          };
        } catch (error: any) {
          console.error('[MCP Tool] Error in get_isda_available_layers:', error);
          return {
            content: [{
              type: 'text',
              text: `I'm having trouble getting layer information. ${error.message || 'Try again in a moment?'}`
            }],
            isError: true
          };
        }
      }
    );

    // Connect and handle the request
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

  } catch (error: any) {
    console.error('[MCP] Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error instanceof Error ? error.message : 'Unknown error'
      },
      id: null
    });
  }
});

// Start server
const HOST = '0.0.0.0';
const server = app.listen(Number(PORT), HOST, () => {
  console.log('');
  console.log('🚀 =========================================');
  console.log('   ISDA Soil Intelligence MCP Server');
  console.log('   Version 1.0.0');
  console.log('=========================================');
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌾 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🔑 ISDA API: ${ISDA_USERNAME && ISDA_PASSWORD ? '✅ Configured' : '⚠️  NOT CONFIGURED'}`);
  console.log(`🛠️  Tools: 2 (get_isda_soil_properties, get_isda_available_layers)`);
  console.log('=========================================');
  console.log('');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

