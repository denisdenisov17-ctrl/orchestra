import { useState } from 'react'

export default function UploadPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const steps = ['Информация', 'BPMN файл', 'OpenAPI', 'Готово']

  const nextStep = () => {
    if (currentStep < steps.length) setCurrentStep((s) => s + 1)
    else {
      alert('Процесс успешно создан!')
      setCurrentStep(1)
    }
  }

  return (
    <div className="page">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="card">
          <div className="card-header">
            <h2>Создание нового процесса</h2>
          </div>
          <div className="card-body">
            <p className="text-secondary mb-24">
              Загрузите BPMN диаграмму и OpenAPI спецификацию для автоматического тестирования
            </p>

            <div className="steps">
              {steps.map((step, index) => {
                const number = index + 1
                const active = number === currentStep
                const completed = number < currentStep
                return (
                  <div key={step} className={`step${active ? ' active' : ''}${completed ? ' completed' : ''}`}>
                    <div className="step-number">{number}</div>
                    <div className="step-title">{step}</div>
                  </div>
                )
              })}
            </div>

            <div className="step-content">Контент шага {currentStep}</div>

            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <a className="btn" href="/">Отмена</a>
              <button className="btn btn-primary" onClick={nextStep}>Далее</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}