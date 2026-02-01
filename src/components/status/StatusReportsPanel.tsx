'use client';

import { useState, useEffect } from 'react';
import {
  ChartLine,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  Lightning,
  Target,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import { AgentIcon } from '@/lib/icons';

interface StatusMetric {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface StatusSection {
  title: string;
  content?: string;
  metrics?: StatusMetric[];
  items?: string[];
}

interface StatusReport {
  id: string;
  agentId: string;
  agentName: string;
  department: string;
  summary: string;
  sections: StatusSection[];
  highlights?: string[];
  blockers?: string[];
  nextSteps?: string[];
  lastUpdated: string;
  createdAt: string;
}

const DEPARTMENT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'Announcements': { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: '📢' },
  'Agency': { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: '🏢' },
  'Funnels': { color: 'text-green-400', bg: 'bg-green-500/10', icon: '🎯' },
};

export function StatusReportsPanel() {
  const [reports, setReports] = useState<StatusReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/status-reports');
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
        // Auto-expand first report if none expanded
        if (data.reports.length > 0 && !expandedReport) {
          setExpandedReport(data.reports[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const filteredReports = selectedDepartment === 'all'
    ? reports
    : reports.filter(r => r.department === selectedDepartment);

  const departments = [...new Set(reports.map(r => r.department))];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ChartLine className="w-5 h-5 text-indigo-400" />
            Status Reports
          </h2>
          <button
            onClick={fetchReports}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <ArrowsClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Department Filter */}
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setSelectedDepartment('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              selectedDepartment === 'all'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'hover:bg-zinc-800 text-zinc-400'
            }`}
          >
            All
          </button>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDepartment(dept)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                selectedDepartment === dept
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <ArrowsClockwise className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <ChartLine className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No status reports yet</p>
            <p className="text-xs mt-1">Agents will submit their reports here</p>
          </div>
        ) : (
          filteredReports.map(report => {
            const config = DEPARTMENT_CONFIG[report.department] || {
              color: 'text-zinc-400',
              bg: 'bg-zinc-500/10',
              icon: '📊',
            };
            const isExpanded = expandedReport === report.id;

            return (
              <div
                key={report.id}
                className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden"
              >
                {/* Report Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                >
                  <div className="flex items-center gap-3">
                    <AgentIcon agentId={report.agentId} size={40} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{report.agentName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                          {config.icon} {report.department}
                        </span>
                      </div>
                      {report.summary && (
                        <p className="text-sm text-zinc-400 mt-1 line-clamp-1">{report.summary}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        {formatTime(report.lastUpdated)}
                      </div>
                      {isExpanded ? (
                        <CaretDown className="w-5 h-5 text-zinc-500 mt-1" />
                      ) : (
                        <CaretRight className="w-5 h-5 text-zinc-500 mt-1" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800/50 p-4 space-y-5">
                    {/* Summary */}
                    {report.summary && (
                      <div>
                        <p className="text-sm text-zinc-300">{report.summary}</p>
                      </div>
                    )}

                    {/* Sections */}
                    {report.sections.map((section, i) => (
                      <div key={i} className="bg-zinc-800/30 rounded-lg p-4">
                        <h4 className="font-medium mb-3">{section.title}</h4>
                        
                        {section.content && (
                          <p className="text-sm text-zinc-400 mb-3">{section.content}</p>
                        )}

                        {section.metrics && section.metrics.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {section.metrics.map((metric, j) => (
                              <div key={j} className="bg-zinc-900/50 rounded-lg p-3">
                                <p className="text-xs text-zinc-500 mb-1">{metric.label}</p>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xl font-bold">{metric.value}</span>
                                  {metric.change && (
                                    <span className={`text-xs flex items-center gap-0.5 ${
                                      metric.trend === 'up' ? 'text-green-400' :
                                      metric.trend === 'down' ? 'text-red-400' :
                                      'text-zinc-500'
                                    }`}>
                                      {metric.trend === 'up' && <ArrowUp className="w-3 h-3" />}
                                      {metric.trend === 'down' && <ArrowDown className="w-3 h-3" />}
                                      {metric.trend === 'neutral' && <Minus className="w-3 h-3" />}
                                      {metric.change}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {section.items && section.items.length > 0 && (
                          <ul className="space-y-1.5 mt-2">
                            {section.items.map((item, j) => (
                              <li key={j} className="text-sm text-zinc-400 flex items-start gap-2">
                                <span className="text-zinc-600">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}

                    {/* Highlights */}
                    {report.highlights && report.highlights.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-green-400">
                          <Lightning className="w-4 h-4" />
                          Highlights
                        </h4>
                        <ul className="space-y-1.5">
                          {report.highlights.map((item, i) => (
                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Blockers */}
                    {report.blockers && report.blockers.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-red-400">
                          <WarningCircle className="w-4 h-4" />
                          Blockers
                        </h4>
                        <ul className="space-y-1.5">
                          {report.blockers.map((item, i) => (
                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                              <WarningCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Next Steps */}
                    {report.nextSteps && report.nextSteps.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-blue-400">
                          <Target className="w-4 h-4" />
                          Next Steps
                        </h4>
                        <ul className="space-y-1.5">
                          {report.nextSteps.map((item, i) => (
                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full border border-blue-400 shrink-0 mt-0.5 flex items-center justify-center text-[10px] text-blue-400">
                                {i + 1}
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
