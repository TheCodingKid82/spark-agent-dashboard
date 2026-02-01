import { NextRequest, NextResponse } from 'next/server';

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;

export async function POST(request: NextRequest) {
  try {
    if (!RAILWAY_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'RAILWAY_TOKEN not configured' },
        { status: 500 }
      );
    }

    const { serviceId, environmentId } = await request.json();

    if (!serviceId) {
      return NextResponse.json(
        { success: false, error: 'serviceId is required' },
        { status: 400 }
      );
    }

    // Get latest deployment for the service
    const latestDeploymentQuery = `
      query GetLatestDeployment($serviceId: String!) {
        deployments(first: 1, input: { serviceId: $serviceId }) {
          edges {
            node {
              id
              status
            }
          }
        }
      }
    `;

    const latestRes = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_TOKEN}`,
      },
      body: JSON.stringify({
        query: latestDeploymentQuery,
        variables: { serviceId },
      }),
    });

    const latestData = await latestRes.json();
    
    if (latestData.errors) {
      return NextResponse.json(
        { success: false, error: latestData.errors[0]?.message || 'Failed to get deployment' },
        { status: 500 }
      );
    }

    // Trigger redeploy using serviceInstanceRedeploy mutation
    const redeployMutation = `
      mutation ServiceInstanceRedeploy($serviceId: String!, $environmentId: String) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `;

    const envId = environmentId || process.env.RAILWAY_ENVIRONMENT_ID;

    const redeployRes = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_TOKEN}`,
      },
      body: JSON.stringify({
        query: redeployMutation,
        variables: { 
          serviceId,
          environmentId: envId,
        },
      }),
    });

    const redeployData = await redeployRes.json();

    if (redeployData.errors) {
      return NextResponse.json(
        { success: false, error: redeployData.errors[0]?.message || 'Redeploy failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Redeploy triggered',
      data: redeployData.data,
    });
  } catch (error) {
    console.error('Redeploy error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET to check if Railway integration is configured
export async function GET() {
  return NextResponse.json({
    configured: !!RAILWAY_TOKEN,
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID || null,
  });
}
