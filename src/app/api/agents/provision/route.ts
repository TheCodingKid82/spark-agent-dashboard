import { NextResponse } from 'next/server';
import { provisionFullStack, waitForDeployment, updateServiceVars } from '@/lib/provisioning/railway';
import { createEmailAccount } from '@/lib/provisioning/email';
import { createWhopAccount } from '@/lib/provisioning/whop';
import { upsertRecord } from '@/lib/provisioning/store';
import { generateWorkspaceFiles, generateAgentDirectoryMd } from '@/lib/provisioning/workspace-generator';
import { generateGatewayConfig, pushGatewayConfig, pushWorkspaceFiles, sendAgentMessage, checkAgentHealth } from '@/lib/provisioning/gateway-config';
import type { ProvisioningRecord } from '@/lib/provisioning/store';
import { getAllRecords } from '@/lib/provisioning/store';

interface ProvisionRequest {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentPurpose: string;
  roleTemplate?: 'sales' | 'support' | 'dev' | 'ops' | 'marketing' | 'custom';
  options: {
    railway: boolean;
    email: boolean;
    whop: boolean;
    telegram: boolean;
    waitForDeploy: boolean;
  };
}

type StepStatus = 'complete' | 'error' | 'skipped' | 'pending';

interface Step {
  id: string;
  status: StepStatus;
  message?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProvisionRequest;
    const { agentId, agentName, agentRole, agentPurpose, roleTemplate, options } = body;

    if (!agentId || !agentName) {
      return NextResponse.json(
        { error: 'agentId and agentName are required' },
        { status: 400 }
      );
    }

    const record: ProvisioningRecord = {
      agentId,
      agentName,
      status: 'provisioning',
      provisionedAt: new Date().toISOString(),
    };

    const steps: Step[] = [];
    let hasErrors = false;

    // === STEP 1: Railway Deployment ===
    if (options.railway) {
      try {
        const result = await provisionFullStack(agentName, agentRole, agentPurpose);
        if (result.success && result.data) {
          record.railwayProjectId = result.data.projectId;
          record.railwayServiceId = result.data.serviceId;
          record.railwayUrl = `https://railway.app/project/${result.data.projectId}`;
          record.railwayDeploymentStatus = result.data.status;
          record.isMock = result.mock;
          record.domain = result.data.domain;
          record.gatewayToken = result.data.gatewayToken;
          record.gatewayUrl = `https://${result.data.domain}`;
          steps.push({
            id: 'railway',
            status: 'complete',
            message: result.mock
              ? 'Mock deployment'
              : `Service created: ${result.data.serviceName} → ${result.data.domain}`,
          });
        } else {
          hasErrors = true;
          steps.push({ id: 'railway', status: 'error', message: result.error });
        }
      } catch (error) {
        hasErrors = true;
        steps.push({ id: 'railway', status: 'error', message: String(error) });
      }
    }

    // === STEP 2: Generate Workspace Files ===
    let workspaceFiles: Record<string, string> = {};
    try {
      workspaceFiles = generateWorkspaceFiles({
        agentName,
        agentRole,
        agentPurpose,
        roleTemplate: roleTemplate || 'custom',
        gatewayToken: record.gatewayToken,
        domain: record.domain,
      });
      record.workspaceFilesGenerated = true;
      steps.push({
        id: 'workspace',
        status: 'complete',
        message: `Generated ${Object.keys(workspaceFiles).length} workspace files`,
      });
    } catch (error) {
      hasErrors = true;
      steps.push({ id: 'workspace', status: 'error', message: String(error) });
    }

    // === STEP 3: Email Provisioning ===
    if (options.email) {
      try {
        const result = await createEmailAccount(agentName);
        if (result.success && result.credentials) {
          record.email = result.credentials.email;
          record.emailPassword = result.credentials.password;
          record.emailStatus = result.credentials.status;
          steps.push({ id: 'email', status: 'complete', message: `Email: ${result.credentials.email}` });
        } else {
          hasErrors = true;
          steps.push({ id: 'email', status: 'error', message: result.error });
        }
      } catch (error) {
        hasErrors = true;
        steps.push({ id: 'email', status: 'error', message: String(error) });
      }
    }

    // === STEP 4: Whop Account ===
    if (options.whop) {
      try {
        const email = record.email || `${agentName.toLowerCase().replace(/\s+/g, '')}@sparkstudio.bot`;
        const result = await createWhopAccount(agentName, email);
        if (result.success && result.credentials) {
          record.whopUsername = result.credentials.username;
          record.whopPassword = result.credentials.password;
          record.whopStatus = result.credentials.status;
          steps.push({ id: 'whop', status: 'complete', message: `Username: ${result.credentials.username}` });
        } else {
          hasErrors = true;
          steps.push({ id: 'whop', status: 'error', message: result.error });
        }
      } catch (error) {
        hasErrors = true;
        steps.push({ id: 'whop', status: 'error', message: String(error) });
      }
    }

    // === STEP 5: Wait for Deployment (optional) ===
    if (options.railway && options.waitForDeploy && record.railwayServiceId && !record.isMock) {
      try {
        steps.push({ id: 'deploy-wait', status: 'pending', message: 'Waiting for build...' });
        const deployResult = await waitForDeployment(record.railwayServiceId);
        if (deployResult.success) {
          record.railwayDeploymentStatus = 'SUCCESS';
          steps[steps.length - 1] = {
            id: 'deploy-wait',
            status: 'complete',
            message: `Build succeeded — ${deployResult.data?.domain || record.domain}`,
          };
        } else {
          hasErrors = true;
          record.railwayDeploymentStatus = 'FAILED';
          steps[steps.length - 1] = {
            id: 'deploy-wait',
            status: 'error',
            message: deployResult.error || 'Build failed',
          };
        }
      } catch (error) {
        hasErrors = true;
        steps[steps.length - 1] = { id: 'deploy-wait', status: 'error', message: String(error) };
      }
    }

    // === STEP 6: Push Workspace Files to Agent ===
    if (record.gatewayUrl && record.gatewayToken && record.railwayDeploymentStatus === 'SUCCESS') {
      try {
        // Wait a moment for the gateway to fully start
        await new Promise(resolve => setTimeout(resolve, 5000));

        const pushResult = await pushWorkspaceFiles(
          record.gatewayUrl,
          record.gatewayToken,
          workspaceFiles,
        );
        if (pushResult.success) {
          steps.push({
            id: 'workspace-push',
            status: 'complete',
            message: `Pushed ${pushResult.pushed.length} files to agent`,
          });
        } else {
          steps.push({
            id: 'workspace-push',
            status: 'error',
            message: `Pushed ${pushResult.pushed.length}, errors: ${pushResult.errors.join(', ')}`,
          });
        }
      } catch (error) {
        steps.push({ id: 'workspace-push', status: 'error', message: String(error) });
      }
    }

    // === STEP 7: Health Check ===
    if (record.gatewayUrl && record.gatewayToken && record.railwayDeploymentStatus === 'SUCCESS') {
      try {
        const health = await checkAgentHealth(record.gatewayUrl, record.gatewayToken);
        record.lastHealthCheck = new Date().toISOString();
        record.healthStatus = health.healthy ? 'healthy' : 'unhealthy';
        steps.push({
          id: 'health-check',
          status: health.healthy ? 'complete' : 'error',
          message: health.healthy ? 'Agent gateway is healthy' : (health.error || 'Unhealthy'),
        });
      } catch (error) {
        steps.push({ id: 'health-check', status: 'error', message: String(error) });
      }
    }

    // === STEP 8: Update Agent Directory ===
    try {
      const allAgents = getAllRecords();
      // Add current agent to the list
      allAgents.push(record);
      const directoryMd = generateAgentDirectoryMd(
        allAgents
          .filter(a => a.railwayServiceId)
          .map(a => ({
            name: a.agentName,
            role: (a as Record<string, unknown>).agentRole as string || 'Agent',
            domain: a.domain,
            status: a.railwayDeploymentStatus || 'unknown',
          }))
      );
      record.agentDirectoryUpdated = true;
      steps.push({
        id: 'agent-directory',
        status: 'complete',
        message: 'Agent directory updated',
      });
    } catch (error) {
      steps.push({ id: 'agent-directory', status: 'error', message: String(error) });
    }

    // === Finalize ===
    record.status = hasErrors ? 'partial' : 'complete';
    record.lastHealthCheck = record.lastHealthCheck || new Date().toISOString();
    record.roleTemplate = roleTemplate;
    upsertRecord(record);

    return NextResponse.json({
      success: !hasErrors,
      record,
      steps,
      message: hasErrors
        ? 'Provisioning completed with some errors'
        : 'Agent provisioned successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Provisioning failed: ${String(error)}` },
      { status: 500 }
    );
  }
}
