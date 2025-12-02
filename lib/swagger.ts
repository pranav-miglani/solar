const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Solar Information System API',
    version: '1.0.0',
    description: 'Complete API documentation for Solar Information System - A comprehensive platform for managing solar plants, vendors, work orders, telemetry, and alerts.',
    contact: {
      name: 'API Support',
      email: 'support@solarhome.space',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://solarhome.space',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
        description: 'Session cookie containing base64-encoded JSON with account information. Set via POST /api/login',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
          },
        },
        required: ['error'],
      },
      Account: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          account_type: { type: 'string', enum: ['SUPERADMIN', 'ORG', 'GOVT', 'DEVELOPER'] },
          org_id: { type: 'integer', nullable: true },
          display_name: { type: 'string', nullable: true },
          logo_url: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          organizations: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          auto_sync_enabled: { type: 'boolean' },
          sync_interval_minutes: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Vendor: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          vendor_type: { type: 'string', enum: ['SOLARMAN', 'SOLARDM', 'SHINEMONITOR', 'PVBLINK', 'FOXESSCLOUD', 'OTHER'] },
          org_id: { type: 'integer' },
          is_active: { type: 'boolean' },
          credentials: { type: 'object' },
          plant_sync_mode: { type: 'string', enum: ['LIST_PLANTS', 'PER_PLANT'], nullable: true },
          per_plant_sync_interval_minutes: { type: 'integer', nullable: true },
          plant_list_sync_morning_ist: { type: 'string', nullable: true },
          plant_list_sync_evening_ist: { type: 'string', nullable: true },
          telemetry_sync_mode: { type: 'string', enum: ['LIST_PLANTS', 'PER_PLANT'], nullable: true },
          telemetry_sync_interval: { type: 'integer', nullable: true },
          restricted_sync_window_start_ist: { type: 'string', nullable: true },
          restricted_sync_window_end_ist: { type: 'string', nullable: true },
          organizations: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
      Plant: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          vendor_plant_id: { type: 'string' },
          name: { type: 'string' },
          capacity_kw: { type: 'number' },
          org_id: { type: 'integer' },
          vendor_id: { type: 'integer' },
          location: { type: 'object', nullable: true },
          current_power_kw: { type: 'number', nullable: true },
          daily_energy_kwh: { type: 'number', nullable: true },
          monthly_energy_mwh: { type: 'number', nullable: true },
          yearly_energy_mwh: { type: 'number', nullable: true },
          total_energy_mwh: { type: 'number', nullable: true },
          network_status: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
          last_update_time: { type: 'string', format: 'date-time', nullable: true },
          vendors: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              vendor_type: { type: 'string' },
            },
          },
          organizations: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
      WorkOrder: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          status: {
            type: 'string',
            enum: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
          },
          created_by: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          work_order_plants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                plant_id: { type: 'integer' },
                assigned_engineer: { type: 'string', format: 'uuid', nullable: true },
                is_active: { type: 'boolean' },
                plants: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    capacity_kw: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
      Alert: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          vendor_id: { type: 'integer' },
          vendor_plant_id: { type: 'string' },
          vendor_alert_id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          status: { type: 'string', enum: ['ACTIVE', 'RESOLVED'] },
          alert_time: { type: 'string', format: 'date-time' },
          resolved_at: { type: 'string', format: 'date-time', nullable: true },
          metadata: { type: 'object', nullable: true },
          plants: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
      TelemetryData: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          generationPower: { type: 'number', description: 'Power in kW' },
          generationValue: { type: 'number', description: 'Energy in kWh', nullable: true },
          voltage: { type: 'number', nullable: true },
          current: { type: 'number', nullable: true },
          temperature: { type: 'number', nullable: true },
        },
      },
      DashboardData: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          metrics: {
            type: 'object',
            properties: {
              totalPlants: { type: 'integer', nullable: true },
              unmappedPlants: { type: 'integer', nullable: true },
              mappedPlants: { type: 'integer', nullable: true },
              totalAlerts: { type: 'integer', nullable: true },
              activeAlerts: { type: 'integer', nullable: true },
              totalWorkOrders: { type: 'integer', nullable: true },
              totalGeneration24h: { type: 'number', nullable: true },
              totalEnergyMwh: { type: 'number', nullable: true },
              dailyEnergyMwh: { type: 'number', nullable: true },
              monthlyEnergyMwh: { type: 'number', nullable: true },
              yearlyEnergyMwh: { type: 'number', nullable: true },
              currentPowerKw: { type: 'number', nullable: true },
              installedCapacityKw: { type: 'number', nullable: true },
            },
          },
          widgets: {
            type: 'object',
            properties: {
              showOrganizations: { type: 'boolean', nullable: true },
              showVendors: { type: 'boolean', nullable: true },
              showPlants: { type: 'boolean', nullable: true },
              showCreateWorkOrder: { type: 'boolean', nullable: true },
              showTelemetryChart: { type: 'boolean', nullable: true },
              showAlertsFeed: { type: 'boolean', nullable: true },
              showWorkOrdersSummary: { type: 'boolean', nullable: true },
            },
          },
        },
      },
    },
  },
  security: [
    {
      cookieAuth: [],
    },
  ],
  paths: {
    '/api/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user with email and password. Returns a session cookie.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@example.com' },
                  password: { type: 'string', format: 'password', example: 'password123' },
                },
              },
              example: {
                email: 'admin@example.com',
                password: 'password123',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            headers: {
              'Set-Cookie': {
                description: 'Session cookie',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    account: { $ref: '#/components/schemas/Account' },
                    message: { type: 'string', example: 'Login successful' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Email and password are required' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Invalid email or password' },
              },
            },
          },
        },
      },
    },
    '/api/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current user',
        description: 'Returns the currently authenticated user information from the session cookie.',
        responses: {
          '200': {
            description: 'Current user information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    account: { $ref: '#/components/schemas/Account' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/accounts': {
      get: {
        tags: ['Accounts'],
        summary: 'List all accounts',
        description: 'Get a list of all accounts. Requires SUPERADMIN or DEVELOPER role.',
        responses: {
          '200': {
            description: 'List of accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accounts: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Account' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '403': {
            description: 'Forbidden - Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Accounts'],
        summary: 'Create new account',
        description: 'Create a new account. Requires SUPERADMIN or DEVELOPER role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'account_type'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  account_type: { type: 'string', enum: ['SUPERADMIN', 'ORG', 'GOVT'] },
                  org_id: { type: 'integer', nullable: true },
                  display_name: { type: 'string', nullable: true },
                  logo_url: { type: 'string', nullable: true },
                },
              },
              example: {
                email: 'user@example.com',
                password: 'password123',
                account_type: 'ORG',
                org_id: 1,
                display_name: 'John Doe',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    account: { $ref: '#/components/schemas/Account' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/accounts/{id}': {
      get: {
        tags: ['Accounts'],
        summary: 'Get account by ID',
        description: 'Get a specific account by ID. Requires SUPERADMIN or DEVELOPER role.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Account details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    account: { $ref: '#/components/schemas/Account' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      put: {
        tags: ['Accounts'],
        summary: 'Update account',
        description: 'Update an existing account. Requires SUPERADMIN or DEVELOPER role.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                  account_type: { type: 'string', enum: ['SUPERADMIN', 'ORG', 'GOVT'] },
                  org_id: { type: 'integer', nullable: true },
                  display_name: { type: 'string', nullable: true },
                  logo_url: { type: 'string', nullable: true },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Account updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    account: { $ref: '#/components/schemas/Account' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Accounts'],
        summary: 'Delete account',
        description: 'Delete an account. Requires SUPERADMIN or DEVELOPER role.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Account deleted successfully',
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/orgs': {
      get: {
        tags: ['Organizations'],
        summary: 'List all organizations',
        description: 'Get a list of all organizations. Role-based filtering applies.',
        responses: {
          '200': {
            description: 'List of organizations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    orgs: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Organization' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create new organization',
        description: 'Create a new organization. Requires SUPERADMIN or DEVELOPER role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Solar Energy Corp' },
                  auto_sync_enabled: { type: 'boolean', example: true },
                  sync_interval_minutes: { type: 'integer', example: 15 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Organization created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    org: { $ref: '#/components/schemas/Organization' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/orgs/{id}': {
      get: {
        tags: ['Organizations'],
        summary: 'Get organization by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Organization details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    org: { $ref: '#/components/schemas/Organization' },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['Organizations'],
        summary: 'Update organization',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  auto_sync_enabled: { type: 'boolean' },
                  sync_interval_minutes: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Organization updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    org: { $ref: '#/components/schemas/Organization' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/vendors': {
      get: {
        tags: ['Vendors'],
        summary: 'List all vendors',
        description: 'Get a list of all vendors with their associated organizations. Role-based filtering applies.',
        responses: {
          '200': {
            description: 'List of vendors and organizations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vendors: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Vendor' },
                    },
                    orgs: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Organization' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Vendors'],
        summary: 'Create new vendor',
        description: 'Create a new vendor. Requires SUPERADMIN or DEVELOPER role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'vendor_type', 'org_id', 'credentials'],
                properties: {
                  name: { type: 'string', example: 'Solarman Vendor' },
                  vendor_type: { type: 'string', enum: ['SOLARMAN', 'SOLARDM', 'SHINEMONITOR', 'PVBLINK', 'FOXESSCLOUD', 'OTHER'] },
                  org_id: { type: 'integer' },
                  credentials: { type: 'object' },
                  is_active: { type: 'boolean', example: true },
                },
              },
              example: {
                name: 'Solarman Vendor',
                vendor_type: 'SOLARMAN',
                org_id: 1,
                credentials: {
                  appId: 'your-app-id',
                  appSecret: 'your-app-secret',
                  username: 'your-username',
                  password: 'your-password',
                },
                is_active: true,
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Vendor created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vendor: { $ref: '#/components/schemas/Vendor' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/vendors/{id}': {
      get: {
        tags: ['Vendors'],
        summary: 'Get vendor by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Vendor details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vendor: { $ref: '#/components/schemas/Vendor' },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ['Vendors'],
        summary: 'Update vendor',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  vendor_type: { type: 'string' },
                  org_id: { type: 'integer' },
                  credentials: { type: 'object' },
                  is_active: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Vendor updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vendor: { $ref: '#/components/schemas/Vendor' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/vendors/{id}/sync-plants': {
      post: {
        tags: ['Vendors'],
        summary: 'Manually sync plants for a vendor',
        description: 'Trigger a manual plant sync for a specific vendor. Requires appropriate permissions.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Plant sync initiated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Plant sync initiated' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/vendors/{id}/sync-alerts': {
      post: {
        tags: ['Vendors'],
        summary: 'Manually sync alerts for a vendor',
        description: 'Trigger a manual alert sync for a specific vendor. Requires appropriate permissions.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Alert sync initiated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Alert sync initiated' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/plants': {
      get: {
        tags: ['Plants'],
        summary: 'List all plants',
        description: 'Get a list of all plants. Role-based filtering applies (ORG users see only their org plants, GOVT users see only mapped plants).',
        responses: {
          '200': {
            description: 'List of plants',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    plants: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Plant' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/plants/{id}': {
      get: {
        tags: ['Plants'],
        summary: 'Get plant by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Plant details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Plant' },
              },
            },
          },
          '404': {
            description: 'Plant not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/plants/{id}/telemetry': {
      get: {
        tags: ['Plants'],
        summary: 'Get plant telemetry',
        description: 'Get historical telemetry data for a plant. Fetched on-demand from vendor APIs.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
          {
            name: 'hours',
            in: 'query',
            schema: { type: 'integer', default: 24 },
            description: 'Number of hours of telemetry data to fetch',
          },
        ],
        responses: {
          '200': {
            description: 'Telemetry data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    telemetry: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TelemetryData' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/workorders': {
      get: {
        tags: ['Work Orders'],
        summary: 'List all work orders',
        description: 'Get a list of all work orders. Role-based filtering applies.',
        parameters: [
          {
            name: 'orgId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by organization ID',
          },
        ],
        responses: {
          '200': {
            description: 'List of work orders',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workOrders: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/WorkOrder' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Work Orders'],
        summary: 'Create new work order',
        description: 'Create a new work order. Requires SUPERADMIN or DEVELOPER role.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'priority', 'plantIds'],
                properties: {
                  title: { type: 'string', example: 'Maintenance Check' },
                  description: { type: 'string', nullable: true },
                  priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                  plantIds: {
                    type: 'array',
                    items: { type: 'integer' },
                    example: [1, 2, 3],
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Work order created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workOrder: { $ref: '#/components/schemas/WorkOrder' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/workorders/{id}': {
      get: {
        tags: ['Work Orders'],
        summary: 'Get work order by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Work order details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workOrder: { $ref: '#/components/schemas/WorkOrder' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/workorders/{id}/status': {
      put: {
        tags: ['Work Orders'],
        summary: 'Update work order status',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Status updated successfully',
          },
        },
      },
    },
    '/api/alerts': {
      get: {
        tags: ['Alerts'],
        summary: 'List all alerts',
        description: 'Get a list of all alerts. Role-based filtering applies.',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['ACTIVE', 'RESOLVED'] },
            description: 'Filter by alert status',
          },
          {
            name: 'severity',
            in: 'query',
            schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            description: 'Filter by alert severity',
          },
        ],
        responses: {
          '200': {
            description: 'List of alerts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    alerts: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Alert' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get dashboard data',
        description: 'Get dashboard metrics and widgets configuration based on user role.',
        responses: {
          '200': {
            description: 'Dashboard data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    role: { type: 'string' },
                    metrics: { $ref: '#/components/schemas/DashboardData' },
                    widgets: { $ref: '#/components/schemas/DashboardData' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/cron/sync-plants': {
      get: {
        tags: ['Cron Jobs'],
        summary: 'Trigger plant sync (cron)',
        description: 'Internal endpoint for cron job to trigger plant synchronization. Requires cron secret.',
        security: [],
        parameters: [
          {
            name: 'secret',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Cron secret for authentication',
          },
        ],
        responses: {
          '200': {
            description: 'Plant sync completed',
          },
          '401': {
            description: 'Invalid cron secret',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/cron/sync-alerts': {
      get: {
        tags: ['Cron Jobs'],
        summary: 'Trigger alert sync (cron)',
        description: 'Internal endpoint for cron job to trigger alert synchronization. Requires cron secret.',
        security: [],
        parameters: [
          {
            name: 'secret',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Cron secret for authentication',
          },
        ],
        responses: {
          '200': {
            description: 'Alert sync completed',
          },
          '401': {
            description: 'Invalid cron secret',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/cron/sync-live-telemetry': {
      get: {
        tags: ['Cron Jobs'],
        summary: 'Trigger live telemetry sync (cron)',
        description: 'Internal endpoint for cron job to trigger live telemetry synchronization. Requires cron secret.',
        security: [],
        parameters: [
          {
            name: 'secret',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Cron secret for authentication',
          },
        ],
        responses: {
          '200': {
            description: 'Live telemetry sync completed',
          },
          '401': {
            description: 'Invalid cron secret',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
};

export { swaggerSpec };
