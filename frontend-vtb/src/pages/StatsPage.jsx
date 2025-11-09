export default function StatsPage() {
  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <h2>Отчеты</h2>
        </div>
        <div className="card-body">
          <p className="text-secondary mb-24">Последние отчеты по тестированию процессов</p>
          <ul className="report-list">
            <li className="report-item">
              <div className="report-title">Оформление заказа — тестовый прогон #142</div>
              <div className="report-meta">03.11.2025 • 12:45 • Успех • 5 шагов</div>
            </li>
            <li className="report-item">
              <div className="report-title">Регистрация пользователя — тестовый прогон #98</div>
              <div className="report-meta">03.11.2025 • 11:10 • Ошибка на шаге 2 • 3 шага</div>
            </li>
            <li className="report-item">
              <div className="report-title">Оплата — тестовый прогон #57</div>
              <div className="report-meta">02.11.2025 • 18:02 • Успех • 4 шага</div>
            </li>
          </ul>

          <div className="card mt-24">
            <div className="card-header">Сводная статистика</div>
            <div className="card-body">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value stat-success">87%</div>
                  <div className="stat-label">Успешные тесты</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value stat-primary">1.2s</div>
                  <div className="stat-label">Среднее время шага</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value stat-warning">5</div>
                  <div className="stat-label">Ошибки API</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}