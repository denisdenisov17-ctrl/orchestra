export default function SettingsPage() {
  return (
    <div className="card">
      <div className="card-header">Настройки</div>
      <div className="card-body">
        <div className="form-group">
          <label className="form-label">Тема</label>
          <select className="form-control">
            <option>Светлая</option>
            <option>Тёмная</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Уведомления</label>
          <select className="form-control">
            <option>Включены</option>
            <option>Выключены</option>
          </select>
        </div>
        <button className="btn btn-primary">Сохранить</button>
      </div>
    </div>
  )
}