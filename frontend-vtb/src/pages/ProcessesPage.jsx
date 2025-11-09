export default function ProcessesPage() {
  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <h2>Тестирование процессов</h2>
        </div>
        <div className="card-body">
          <p className="text-secondary mb-24">Запустите тестирование ваших бизнес-процессов</p>
          <div className="process-list">
            <ul className="process-list">
              <li className="process-item">
                <div className="process-info">
                  <div className="process-name">Оформление заказа</div>
                  <div className="process-description">Тестирование учета шагов и API интеграций.</div>
                  <div className="process-meta">
                    <span>Шагов: 5</span>
                    <span>Эндпоинтов: 3</span>
                    <span>Последний тест: 2025-11-03</span>
                  </div>
                </div>
                <div className="process-actions">
                  <button className="btn">Запустить</button>
                  <button className="btn">Редактировать</button>
                </div>
              </li>
              <li className="process-item">
                <div className="process-info">
                  <div className="process-name">Регистрация пользователя</div>
                  <div className="process-description">Проверка валидаций и триггеров.</div>
                  <div className="process-meta">
                    <span>Шагов: 3</span>
                    <span>Эндпоинтов: 2</span>
                    <span>Последний тест: 2025-11-03</span>
                  </div>
                </div>
                <div className="process-actions">
                  <button className="btn">Запустить</button>
                  <button className="btn">Редактировать</button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}