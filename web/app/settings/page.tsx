export default function SettingsPage() {
  return (
    <>
      <div className="breadcrumbs"><span>Manage</span><span>/</span><strong>Settings</strong></div>
      <section className="page-header">
        <div><h1>Settings</h1><p>Workspace, model, and data-source configuration.</p></div>
      </section>

      <section className="settings-layout">
        <article className="panel">
          <div className="panel-header"><div><h2>Workspace</h2><p>General application settings.</p></div></div>
          <div className="settings-row"><div><strong>Workspace name</strong><span>Displayed across reports and dashboards.</span></div><input value="Senvu" readOnly /></div>
          <div className="settings-row"><div><strong>Default date range</strong><span>Used when opening analytics pages.</span></div><select defaultValue="30"><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
        </article>

        <article className="panel">
          <div className="panel-header"><div><h2>Data connection</h2><p>Current hosted database status.</p></div></div>
          <div className="connection-status-large"><span className="status-dot" /><div><strong>Supabase connected</strong><span>Server-side credentials are loaded from environment variables.</span></div></div>
        </article>
      </section>
    </>
  );
}
