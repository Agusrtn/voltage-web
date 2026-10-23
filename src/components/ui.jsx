import { Link } from 'react-router-dom'

export function ChannelMark({ channel, compact = false }) {
  if (channel?.logo_url) return <img className="channel-logo" src={channel.logo_url} alt={`Logo de ${channel.name}`} />
  return <span className={`channel-mark ${compact ? 'compact' : ''}`} aria-hidden="true">{channel?.name?.slice(0, 2).toUpperCase() || 'VT'}</span>
}

export function Status({ children, tone = 'muted' }) {
  return <span className={`status ${tone}`}><i />{children}</span>
}

export function EmptyState({ title, detail, action, to }) {
  return <section className="empty-state">
    <span className="empty-icon">◇</span>
    <h2>{title}</h2>
    <p>{detail}</p>
    {action && (to ? <Link className="button primary" to={to}>{action}</Link> : action)}
  </section>
}

export function Notice({ children, tone = 'info' }) {
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

export function ContentHeader({ eyebrow, title, detail, action }) {
  return <header className="content-header">
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{detail && <p>{detail}</p>}</div>
    {action}
  </header>
}

export function LoadingGrid() {
  return <div className="loading-grid" aria-label="Cargando contenido"><span /><span /><span /></div>
}
