import { useEffect, useMemo, useState } from "react";
import { fixtureDashboardMeta, fixtureDashboardOutput } from "./fixture-preview";
import type { DashboardMeta, DashboardOutput, Finding, Risk, Severity, WidgetPayload } from "./types";
import "./styles.css";

declare global {
  interface Window {
    openai?: {
      toolOutput?: DashboardOutput;
      toolResponseMetadata?: DashboardMeta;
      theme?: "light" | "dark";
      notifyIntrinsicHeight?: () => void;
    };
  }
}

function initialPayload(): WidgetPayload {
  return {
    structuredContent: window.openai?.toolOutput ?? fixtureDashboardOutput,
    meta: window.openai?.toolResponseMetadata ?? fixtureDashboardMeta
  };
}

function severityLabel(severity: Severity): string {
  if (severity === "critical") return "Critical";
  if (severity === "important") return "Important";
  return "Minor";
}

function riskLabel(risk: Risk): string {
  if (risk === "high") return "High";
  if (risk === "medium") return "Medium";
  if (risk === "low") return "Low";
  return "Unknown";
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "critical" | "important" | "neutral" }) {
  return (
    <div className={`metric metric-${tone ?? "neutral"}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <article className={`finding finding-${finding.severity}`}>
      <div>
        <span className="finding-id">{finding.id}</span>
        <h3>{finding.title}</h3>
      </div>
      <span className={`badge badge-${finding.severity}`}>{severityLabel(finding.severity)}</span>
      <p>{finding.recommendation}</p>
      <div className="refs">{finding.evidenceRefs.join(" · ")}</div>
    </article>
  );
}

function RiskMatrix({ output }: { output: DashboardOutput }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Architecture Risk Matrix</h2>
        <span>{riskLabel(output.architecture.architectureRisk)} architecture · {riskLabel(output.architecture.migrationRisk)} migration</span>
      </div>
      <div className="risk-grid">
        {output.architecture.riskMatrix.map((item) => (
          <div className={`risk-cell risk-${item.risk}`} key={item.area}>
            <span>{item.area}</span>
            <strong>{riskLabel(item.risk)}</strong>
            <small>{item.evidenceRefs.length > 0 ? item.evidenceRefs.join(", ") : "No direct evidence"}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function TestGapTable({ output }: { output: DashboardOutput }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Test Gap Table</h2>
        <span>{output.tests.testFilesChanged} test file changes</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Area</th>
            <th>Severity</th>
            <th>Evidence</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {output.tests.gaps.map((gap) => (
            <tr key={`${gap.area}-${gap.severity}`}>
              <td>{gap.area}</td>
              <td><span className={`badge badge-${gap.severity}`}>{severityLabel(gap.severity)}</span></td>
              <td>{gap.evidenceRefs.join(", ")}</td>
              <td>{gap.recommendation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FileImpactMap({ output, meta }: { output: DashboardOutput; meta: DashboardMeta }) {
  const diffPreview = useMemo(() => {
    const firstFile = output.fileImpact.topFiles[0]?.path;
    return firstFile ? meta.diffPreviews?.[firstFile] : undefined;
  }, [meta.diffPreviews, output.fileImpact.topFiles]);

  return (
    <section className="panel file-panel">
      <div className="panel-heading">
        <h2>File Impact Map</h2>
        <span>{output.fileImpact.totalFiles} files</span>
      </div>
      <div className="file-map">
        {output.fileImpact.topFiles.map((file) => (
          <div className={`file-row impact-${file.impact}`} key={file.path}>
            <div>
              <strong>{file.path}</strong>
              <span>{file.status}</span>
            </div>
            <div className="file-stats">+{file.additions ?? 0} / -{file.deletions ?? 0}</div>
          </div>
        ))}
      </div>
      {diffPreview ? <pre className="diff-preview">{diffPreview}</pre> : null}
    </section>
  );
}

function PacketPreview({ output, meta }: { output: DashboardOutput; meta: DashboardMeta }) {
  return (
    <section className="panel packet-panel">
      <div className="panel-heading">
        <h2>Packet Preview</h2>
        <span>{output.packetPreview.available ? "Available" : "Not generated"}</span>
      </div>
      {output.packetPreview.available ? (
        <>
          <div className="packet-summary">
            <Metric label="Evidence" value={output.packetPreview.evidenceCount ?? 0} />
            <Metric label="Redactions" value={output.packetPreview.redactionsCount ?? 0} tone="important" />
            <Metric label="Verdict" value={output.packetPreview.verdict ?? output.verdict} tone={output.verdict === "high_risk" ? "critical" : "neutral"} />
          </div>
          <pre className="packet-text">{meta.packetMarkdownPreview}</pre>
        </>
      ) : (
        <p className="empty">Generate the engineering packet to preview the GPT-5.5 Pro handoff.</p>
      )}
    </section>
  );
}

export function App() {
  const [payload, setPayload] = useState<WidgetPayload>(() => initialPayload());
  const output = payload.structuredContent;
  const meta = payload.meta;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0" || message.method !== "ui/notifications/tool-result") return;
      setPayload({
        structuredContent: message.params?.structuredContent ?? fixtureDashboardOutput,
        meta: message.params?._meta ?? {}
      });
    };

    window.addEventListener("message", onMessage, { passive: true });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    window.openai?.notifyIntrinsicHeight?.();
  }, [payload]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">{output.target.sourceType} · {output.target.sourceId}</span>
          <h1>Repository Review Dashboard</h1>
          <p>{output.target.displayRef} · {output.target.baseRef ?? "base"} → {output.target.headRef ?? "head"}</p>
        </div>
        <div className={`verdict verdict-${output.verdict}`}>{output.verdict.replace("_", " ")}</div>
      </header>

      <section className="metric-grid" aria-label="Review metrics">
        <Metric label="Critical" value={output.counts.critical} tone="critical" />
        <Metric label="Important" value={output.counts.important} tone="important" />
        <Metric label="Files" value={output.changeSummary.filesChanged} />
        <Metric label="Tests" value={output.tests.testsDetected} />
        <Metric label="Redactions" value={output.counts.secretsRedacted} tone="important" />
      </section>

      {output.warnings.length > 0 ? <div className="warning">{output.warnings.join(" ")}</div> : null}

      <section className="panel">
        <div className="panel-heading">
          <h2>Changed Files Summary</h2>
          <span>+{output.changeSummary.additions ?? 0} / -{output.changeSummary.deletions ?? 0}</span>
        </div>
        <div className="area-list">
          {output.changeSummary.primaryAreas.map((area) => <span key={area}>{area}</span>)}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Severity-Ranked Findings</h2>
          <span>{output.findings.length} findings</span>
        </div>
        <div className="findings">
          {output.findings.map((finding) => <FindingRow finding={finding} key={finding.id} />)}
        </div>
      </section>

      <div className="two-column">
        <RiskMatrix output={output} />
        <TestGapTable output={output} />
      </div>

      <FileImpactMap output={output} meta={meta} />
      <PacketPreview output={output} meta={meta} />
    </main>
  );
}
