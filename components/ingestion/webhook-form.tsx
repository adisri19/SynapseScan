import React, { useState, useEffect } from 'react';

export function WebhookForm() {
  const [repoUrl, setRepoUrl] = useState('');
  const [secretToken, setSecretToken] = useState('');
  const [events, setEvents] = useState({
    push: true,
    pr_open: true,
    pr_merge: false,
    tag_create: false
  });
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOpenInstructions, setIsOpenInstructions] = useState(false);

  // Generate a random UUID secret token on mount
  useEffect(() => {
    generateNewSecret();
  }, []);

  const generateNewSecret = () => {
    // Basic UUID generator in JS
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    setSecretToken(uuid);
  };

  const getWebhookUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}/api/webhook/analyze`;
    }
    return 'http://localhost:3000/api/webhook/analyze';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const activeEvents = Object.keys(events).filter(key => events[key as keyof typeof events]);

    try {
      const response = await fetch('/api/webhook/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repoUrl,
          secretToken,
          events: activeEvents
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
        throw new Error(result.error || 'Failed to save webhook config');
      }

      setSuccessMsg('Webhook configured successfully!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 shadow-lg space-y-6">
      <div>
        <span className="text-[#10B981] text-xs font-mono font-bold uppercase tracking-widest block">
          Webhook Configuration
        </span>
        <h3 className="text-white text-lg font-bold font-sans mt-1">
          CI/CD Webhook Integration
        </h3>
        <p className="text-slate-400 text-xs font-sans mt-0.5">
          Trigger automated code quality audits on every push or pull request event.
        </p>
      </div>

      <form onSubmit={handleSaveConfig} className="space-y-5">
        {/* Read-only Webhook URL */}
        <div className="space-y-1.5">
          <label className="block text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
            Your Webhook Endpoint
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={getWebhookUrl()}
              className="flex-1 bg-[#0B0F17] border border-[#1F2937] text-slate-400 rounded-lg px-3.5 py-2.5 font-mono text-xs select-all outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="bg-[#1F2937] hover:bg-slate-700 active:bg-slate-800 text-slate-300 font-semibold px-4 py-2.5 rounded-lg text-xs transition min-w-[85px] border border-slate-700/30"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Target Repository URL Context */}
        <div className="space-y-1.5">
          <label htmlFor="webhookRepoUrl" className="block text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
            Repository URL (for context)
          </label>
          <input
            type="url"
            id="webhookRepoUrl"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            required
            className="w-full bg-[#0B0F17] border border-[#1F2937] text-white placeholder-slate-600 rounded-lg px-4 py-3 font-mono text-sm focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] outline-none transition"
          />
        </div>

        {/* Secret Token Field */}
        <div className="space-y-1.5">
          <label htmlFor="secretToken" className="block text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
            Secret Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              id="secretToken"
              value={secretToken}
              onChange={(e) => setSecretToken(e.target.value)}
              required
              className="flex-1 bg-[#0B0F17] border border-[#1F2937] text-white rounded-lg px-4 py-2.5 font-mono text-sm focus:border-[#10B981] outline-none"
            />
            <button
              type="button"
              onClick={generateNewSecret}
              className="bg-[#1F2937] hover:bg-slate-700 text-slate-300 font-semibold px-3 py-2.5 rounded-lg text-xs transition border border-slate-700/30 font-mono"
            >
              Regenerate
            </button>
          </div>
        </div>

        {/* Trigger Event check boxes */}
        <div className="space-y-2">
          <label className="block text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
            Trigger Events
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-sans text-slate-300">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={events.push}
                onChange={(e) => setEvents({ ...events, push: e.target.checked })}
                className="w-4 h-4 rounded accent-[#10B981] bg-[#0B0F17] border border-[#1F2937]"
              />
              <span>Push to main/master</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={events.pr_open}
                onChange={(e) => setEvents({ ...events, pr_open: e.target.checked })}
                className="w-4 h-4 rounded accent-[#10B981] bg-[#0B0F17] border border-[#1F2937]"
              />
              <span>Pull Request opened</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={events.pr_merge}
                onChange={(e) => setEvents({ ...events, pr_merge: e.target.checked })}
                className="w-4 h-4 rounded accent-[#10B981] bg-[#0B0F17] border border-[#1F2937]"
              />
              <span>Pull Request merged</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={events.tag_create}
                onChange={(e) => setEvents({ ...events, tag_create: e.target.checked })}
                className="w-4 h-4 rounded accent-[#10B981] bg-[#0B0F17] border border-[#1F2937]"
              />
              <span>Tag / Release created</span>
            </label>
          </div>
        </div>

        {/* Instructions accordion */}
        <div className="bg-[#0B0F17] border border-[#1F2937] rounded-xl overflow-hidden shadow">
          <button
            type="button"
            onClick={() => setIsOpenInstructions(!isOpenInstructions)}
            className="w-full px-5 py-3 flex items-center justify-between text-left focus:outline-none hover:bg-slate-800/10 transition"
          >
            <span className="text-white font-semibold text-xs uppercase tracking-wide font-sans">
              How to set this up
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpenInstructions ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isOpenInstructions && (
            <div className="px-5 pb-5 pt-1 text-slate-400 text-xs font-sans border-t border-[#1F2937]/50 space-y-2">
              <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                <li>Copy the webhook URL above.</li>
                <li>Go to your repository **Settings → Webhooks** (on GitHub/GitLab).</li>
                <li>Paste the URL and set **Content-Type** to `application/json`.</li>
                <li>Paste the Secret Token into the webhook **Secret** field.</li>
                <li>Select your trigger events and save.</li>
                <li>CodePulse will automatically run a full audit on each trigger event.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving || !repoUrl}
          className="w-full bg-[#10B981] hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 font-semibold rounded-lg px-6 py-3 text-sm transition tracking-wider flex items-center justify-center gap-2"
        >
          {isSaving ? 'Configuring Webhook...' : 'Save Webhook Config'}
        </button>
      </form>

      {successMsg && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-lg text-emerald-400 text-xs font-mono text-center">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs font-mono text-center">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
export default WebhookForm;
