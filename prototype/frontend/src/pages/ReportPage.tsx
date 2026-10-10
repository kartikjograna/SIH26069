import { CitizenReportForm } from '../components/CitizenReportForm'

export function ReportPage() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '24px',
      maxWidth: '1100px',
      margin: '0 auto',
      width: '100%'
    }}>
      <div style={{ gridColumn: 'span 2' }}>
        <h1 className="section-title">Submit a Weather Report</h1>
        <p className="section-sub" style={{ marginBottom: '24px' }}>
          Report live weather conditions. Your submission is verified by 5 ML models in real-time.
        </p>
        <CitizenReportForm />
      </div>

      <aside style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Reporting Guide</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
              <span><strong>Be Specific:</strong> Mention landmarks (e.g., "Near Andheri Station") rather than just the city.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
              <span><strong>Quantify:</strong> Use descriptions like "knee-deep water" or "visibility less than 10m".</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
              <span><strong>Timestamps:</strong> Note exactly when the event started or peaked.</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">How it works</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Your report is processed by an ensemble of 5 ML models:
            <br /><br />
            1. Fake-news detection<br />
            2. Source credibility check<br />
            3. Image forensics<br />
            4. Event classification<br />
            5. Duplicate detection
          </p>
        </div>
      </aside>
    </div>
  )
}
