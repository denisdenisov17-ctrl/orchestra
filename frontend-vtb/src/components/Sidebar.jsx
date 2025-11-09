import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  const links = [
    { to: '/', label: 'Главная', icon: '🏠', end: true },
    { to: '/upload', label: 'Загрузить процесс', icon: '📤' },
    { to: '/mapping', label: 'Сопоставление', icon: '🔄' },
    { to: '/execution', label: 'Выполнение тестов', icon: '▶️' },
    { to: '/processes', label: 'Тестирование', icon: '⚡' },
    { to: '/reports', label: 'Отчеты', icon: '📈' },
    { to: '/settings', label: 'Настройки', icon: '⚙️' },
  ]

  return (
    <nav className="sidebar" id="sidebar">
      <ul className="menu">
        {links.map(({ to, label, icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}
            >
              <span className="icon">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}