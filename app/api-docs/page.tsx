'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading API documentation...</p>
      </div>
    </div>
  ),
});

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    // Check if we're in production by checking the API response
    const fetchSpec = async () => {
      try {
        const response = await fetch('/api/docs/swagger.json');
        if (!response.ok) {
          if (response.status === 404) {
            setIsProduction(true);
            setError('API documentation is not available in production for security reasons.');
          } else {
            throw new Error('Failed to fetch OpenAPI spec');
          }
        } else {
          const data = await response.json();
          // Check if response is an error object
          if (data.error) {
            setIsProduction(true);
            setError(data.error);
          } else {
            setSpec(data);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSpec();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h1 className="text-2xl font-bold">
              {isProduction ? 'API Documentation Unavailable' : 'API Documentation Error'}
            </h1>
          </div>
          <p className="text-destructive mb-2">{error}</p>
          {isProduction && (
            <p className="text-sm text-muted-foreground mt-4">
              API documentation is disabled in production environments to prevent unauthorized access to API endpoints and database queries.
              Please use the development environment to access the Swagger documentation.
            </p>
          )}
        </Card>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="container mx-auto py-8">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">API Documentation</h1>
          <p className="text-muted-foreground">No documentation available.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
          <p className="text-muted-foreground">
            Complete OpenAPI documentation for Solar Information System
          </p>
        </div>
        <Card className="overflow-hidden">
          <div className="swagger-ui-wrapper">
            <SwaggerUI spec={spec} />
          </div>
        </Card>
      </div>
      <style jsx global>{`
        .swagger-ui-wrapper {
          background: hsl(var(--background));
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 20px 0;
        }
        .swagger-ui .scheme-container {
          background: hsl(var(--card));
          padding: 20px;
        }
      `}</style>
    </div>
  );
}

