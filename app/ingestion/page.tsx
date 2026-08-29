'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../lib/store';
import { PageHeader } from '../../components/layout/page-header';
import { SourceTabs } from '../../components/ingestion/source-tabs';
import { GitHubUrlForm } from '../../components/ingestion/github-url-form';
import { GitLabUrlForm } from '../../components/ingestion/gitlab-url-form';
import { WebhookForm } from '../../components/ingestion/webhook-form';
import { ParserSettings } from '../../components/ingestion/parser-settings';
import { ProgressStepper } from '../../components/ingestion/progress-stepper';
import { ErrorBoundary } from '../../components/error-boundary';

export default function IngestionPage() {
  const router = useRouter();
  const { tenantName, setCurrentRunId, setDashboardData } = useAppStore();

  const [activeTab, setActiveTab] = useState<'github' | 'gitlab' | 'webhook'>('github');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub Form Submit handler
  const handleRunGitHubAudit = async (repoUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          repoUrl,
          triggeredBy: 'Enterprise Administrator'
        }),
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text || 'An error occurred on the server.' };
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze GitHub repository');
      }

      if (result.success && result.data) {
        setCurrentRunId(result.data.run.id);
        setDashboardData(result.data);
        router.push(`/dashboard?runId=${result.data.run.id}`);
      } else {
        throw new Error('GitHub analysis completed but details were missing.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during GitHub analysis.');
      setIsLoading(false);
    }
  };

  // GitLab Form Submit handler
  const handleRunGitLabAudit = async (repoUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-gitlab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repoUrl,
          triggeredBy: 'Enterprise Administrator'
        })
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text || 'An error occurred on the server.' };
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze GitLab repository');
      }

      if (result.success && result.data) {
        setCurrentRunId(result.data.run.id);
        setDashboardData(result.data);
        router.push(`/dashboard?runId=${result.data.run.id}`);
      } else {
        throw new Error('GitLab analysis completed but details were missing.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during GitLab analysis.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <PageHeader
        tenantName={tenantName}
        title="Repository Analysis Setup"
        subtitle="Configure ingestion source, custom AST thresholds, and trigger a pipeline audit."
      />

      <div className="p-6 md:p-8 space-y-6 md:space-y-8 max-w-5xl w-full mx-auto pb-12">
        <ErrorBoundary>
          {/* Header Label / Ingestion Segment */}
          <div className="space-y-2">
            <span className="text-[#10B981] text-xs font-mono font-bold uppercase tracking-widest block">
              Ingestion Pipeline
            </span>
            <h3 className="text-white text-lg font-bold font-sans">
              Choose Codebase Source
            </h3>
          </div>

          {/* Ingestion Source Tabs */}
          <div className="flex">
            <SourceTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          {/* GitHub Tab Active */}
          {activeTab === 'github' && (
            <div className="space-y-6">
              <GitHubUrlForm 
                onSubmit={handleRunGitHubAudit} 
                isLoading={isLoading} 
                error={error} 
              />
              
              <ParserSettings />
              <ProgressStepper isAnalyzing={isLoading} />
            </div>
          )}

          {/* GitLab Tab Active */}
          {activeTab === 'gitlab' && (
            <div className="space-y-6">
              <GitLabUrlForm 
                onSubmit={handleRunGitLabAudit} 
                isLoading={isLoading} 
                error={error} 
              />
              
              <ParserSettings />
              <ProgressStepper isAnalyzing={isLoading} />
            </div>
          )}

          {/* CI/CD Webhook Tab Active */}
          {activeTab === 'webhook' && (
            <div className="space-y-6">
              <WebhookForm />
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
