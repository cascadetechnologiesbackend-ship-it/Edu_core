"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Server,
  Cpu,
  Database,
  Activity,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  HardDrive,
  Radio,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";
import { getInfrastructureTelemetryAction, InfrastructureTelemetry } from "./telemetryActions";

interface Props {
  initialTelemetry: InfrastructureTelemetry;
}

export function InfrastructureTelemetryPanel({ initialTelemetry }: Props) {
  const [telemetry, setTelemetry] = useState<InfrastructureTelemetry>(initialTelemetry);
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getInfrastructureTelemetryAction();
      if (res.success && res.data) {
        setTelemetry(res.data);
        setLastRefreshed(new Date());
      }
    });
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      handleRefresh();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-400" /> Real-Time AWS Infrastructure Telemetry
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              AWS {telemetry.awsRegion.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live inspection of ECS Fargate containers, Application Load Balancer traffic, and RDS PostgreSQL database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition active:scale-95 disabled:opacity-50"
            title="Refresh metrics from CloudWatch"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-indigo-400" : ""}`} />
            <span>{isPending ? "Polling..." : "Refresh"}</span>
          </button>

          <a
            href={telemetry.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition active:scale-95"
            title="Open native dashboard in AWS CloudWatch Console"
          >
            <span>CloudWatch Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 4 Infrastructure Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ECS Fargate Server Compute */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" /> ECS Compute
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
              FARGATE
            </span>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-slate-400">CPU Load</span>
              <span className="text-base font-extrabold text-white font-mono">
                {telemetry.ecs.cpuPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(telemetry.ecs.cpuPercent * 2, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-slate-400">Memory Usage</span>
              <span className="text-base font-extrabold text-white font-mono">
                {telemetry.ecs.memoryPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(telemetry.ecs.memoryPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-850 truncate">
            Task: {telemetry.ecs.service}
          </div>
        </div>

        {/* Card 2: ALB Network & Latency */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" /> ALB Network
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
              HEALTHY
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-[11px] text-slate-400">Response Latency</span>
              <div className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">
                {telemetry.alb.latencyMs} ms
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Request Traffic</span>
              <div className="text-lg font-extrabold text-white font-mono mt-0.5">
                {telemetry.alb.requestCount}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-[11px]">
            <span className="text-slate-400">4XX / 5XX Errors:</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {telemetry.alb.errors4xx} / {telemetry.alb.errors5xx}
            </span>
          </div>
        </div>

        {/* Card 3: RDS PostgreSQL Storage & Connections */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-400" /> RDS PostgreSQL
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">
              t4g.micro
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-[11px] text-slate-400">Free Storage</span>
              <div className="text-lg font-extrabold text-white font-mono mt-0.5">
                {telemetry.rds.freeStorageGb} GB
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">DB Connections</span>
              <div className="text-lg font-extrabold text-cyan-400 font-mono mt-0.5">
                {telemetry.rds.connections} <span className="text-xs text-slate-500">/ 25</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-[11px]">
            <span className="text-slate-400">Query Ping:</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {telemetry.dbLatencyMs} ms
            </span>
          </div>
        </div>

        {/* Card 4: CloudWatch Alarms & System Uptime */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-400" /> Active Alarms
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono">
              SNS LINKED
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            {telemetry.alarms.slice(0, 3).map((a) => (
              <div key={a.name} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 truncate max-w-[140px]">{a.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold ${
                    a.state === "OK"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-rose-400 bg-rose-500/10"
                  }`}
                >
                  {a.state}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-[11px]">
            <span className="text-slate-400">Server Uptime:</span>
            <span className="font-mono text-slate-300">
              {Math.floor(telemetry.uptimeSeconds / 60)}m {telemetry.uptimeSeconds % 60}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
