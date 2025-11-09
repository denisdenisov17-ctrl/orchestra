import { useMemo } from 'react'

export default function HomePage() {
  const stats = useMemo(() => ({
    totalProcesses: 8,
    readyForTesting: 3,
    successfulTests: 45,
    timeSaved: 32,
  }), [])

  const processes = useMemo(() => ([
    {
      id: '1',
      name: 'Оформление заказа',
      description: 'Процесс оформления заказа в интернет-магазине',
      status: 'ready',
      lastTest: '2025-11-03',
      steps: 5,
      endpoints: 3,
    },
    {
      id: '2',
      name: 'Регистрация пользователя',
      description: 'Процесс регистрации нового пользователя',
      status: 'needs-setup',
      lastTest: '2025-11-03',
      steps: 3,
      endpoints: 2,
    },
  ]), [])

  const getStatusClass = (status) => ({
    ready: 'tag-success',
    'needs-setup': 'tag-warning',
    error: 'tag-error',
  }[status] || 'tag-blue')

  return (
    <div className="page">
      <h2>Добро пожаловать</h2>
      <p className="text-secondary mb-24">Автоматизируйте тестирование бизнес-процессов и API интеграций</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value stat-primary">{stats.totalProcesses}</div>
          <div className="stat-label">Всего процессов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-success">{stats.readyForTesting}</div>
          <div className="stat-label">Готово к тестированию</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-warning">{stats.successfulTests}</div>
          <div className="stat-label">Успешных тестов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value stat-purple">{stats.timeSaved}</div>
          <div className="stat-label">Экономия времени (ч/нед)</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            Быстрый старт
            <a href="#" className="btn">Все действия</a>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a className="btn btn-primary btn-large" href="/upload">📤 Загрузить новый процесс</a>
              <a className="btn btn-large" href="/mapping">🔄 Сопоставить процесс с API</a>
              <a className="btn btn-large" href="/execution">▶️ Выполнить тесты</a>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Последние процессы</div>
          <div className="card-body">
            <ul className="process-list">
              {processes.map((p) => (
                <li className="process-item" key={p.id}>
                  <div className="process-info">
                    <div className="process-name">
                      {p.name}
                      <span className={`tag ${getStatusClass(p.status)}`}>{p.status === 'ready' ? 'Готов' : p.status === 'needs-setup' ? 'Требует настройки' : 'Неизвестно'}</span>
                    </div>
                    <div className="process-description">{p.description}</div>
                    <div className="process-meta">
                      <span>Шагов: {p.steps}</span>
                      <span>Эндпоинтов: {p.endpoints}</span>
                      <span>Последний тест: {p.lastTest}</span>
                    </div>
                  </div>
                  <div className="process-actions">
                    <button className="btn">Запустить</button>
                    <button className="btn">Редактировать</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid-3 mt-24">
        <div className="card">
          <div className="card-header">Статус системы</div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Парсер BPMN</span>
                <span className="tag tag-success">Работает</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Анализатор OpenAPI</span>
                <span className="tag tag-success">Работает</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ИИ анализ</span>
                <span className="tag tag-blue">Доступен</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">Ближайшие тесты</div>
          <div className="card-body">
            <p className="text-secondary">Нет запланированных тестов</p>
          </div>
        </div>
        <div className="card">
          <div className="card-header">Рекомендации</div>
          <div className="card-body">
            <p className="text-secondary">Загрузите свой первый процесс для начала работы</p>
          </div>
        </div>
      </div>
    </div>
  )
}