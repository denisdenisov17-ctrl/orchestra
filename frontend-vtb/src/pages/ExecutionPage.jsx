import { useState } from 'react';
import '../styles/components/execution.css';

export default function ExecutionPage() {
  const [bpmnFile, setBpmnFile] = useState(null);
  const [mappingResult, setMappingResult] = useState(null);
  const [testData, setTestData] = useState(null);
  const [config, setConfig] = useState({
    baseUrl: '',
    authType: 'NONE',
    authValue: '',
    authUsername: '',
    authPassword: '',
    authHeaderName: '',
    requestTimeoutMs: 30000,
    connectionTimeoutMs: 10000,
    maxExecutionTimeMs: 120000,
    retryCount: 0,
    retryDelayMs: 1000,
  });
  const [executionResult, setExecutionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [stopOnFirstError, setStopOnFirstError] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState({});

  const handleBpmnUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setBpmnFile(e.target.result);
      reader.readAsText(file);
    }
  };

  const handleMappingUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          setMappingResult(JSON.parse(e.target.result));
        } catch (err) {
          setError('Ошибка парсинга JSON файла маппинга: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTestDataUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          setTestData(data);
          if (data.variants && data.variants.length > 0) {
            setVariantIndex(0);
          }
        } catch (err) {
          setError('Ошибка парсинга JSON файла тестовых данных: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExecute = async () => {
    if (!bpmnFile || !mappingResult || !testData) {
      setError('Пожалуйста, загрузите все необходимые файлы: BPMN, маппинг и тестовые данные');
      return;
    }

    if (!config.baseUrl) {
      setError('Пожалуйста, укажите базовый URL API');
      return;
    }

    setLoading(true);
    setError(null);
    setExecutionResult(null);

    try {
      // Формируем ExecutionConfig
      const executionConfig = {
        baseUrl: config.baseUrl,
        defaultHeaders: {},
        authConfig: {
          type: config.authType,
          value: config.authValue,
          username: config.authUsername,
          password: config.authPassword,
          headerName: config.authHeaderName,
        },
        requestTimeoutMs: config.requestTimeoutMs,
        connectionTimeoutMs: config.connectionTimeoutMs,
        maxExecutionTimeMs: config.maxExecutionTimeMs,
        retryCount: config.retryCount,
        retryDelayMs: config.retryDelayMs,
      };

      // Формируем TestExecutionRequest
      const request = {
        processModel: null, // Будет распарсен на бэкенде
        mappingResult: mappingResult,
        testData: testData,
        config: executionConfig,
        testDataVariantIndex: variantIndex,
        stopOnFirstError: stopOnFirstError,
      };

      // Используем простой метод с параметрами
      const formData = new URLSearchParams();
      formData.append('bpmnXml', bpmnFile);
      formData.append('testDataJson', JSON.stringify(testData));
      formData.append('mappingResultJson', JSON.stringify(mappingResult));
      formData.append('baseUrl', config.baseUrl);
      formData.append('variantIndex', variantIndex.toString());
      formData.append('stopOnFirstError', stopOnFirstError.toString());

      const response = await fetch('/api/execution/execute-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Ошибка при выполнении теста');
      }

      const result = await response.json();
      setExecutionResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'SUCCESS':
        return 'tag-success';
      case 'FAILED':
        return 'tag-error';
      case 'PARTIAL':
        return 'tag-warning';
      default:
        return 'tag-blue';
    }
  };

  const getStepStatusClass = (status) => {
    switch (status) {
      case 'SUCCESS':
        return 'tag-success';
      case 'FAILED':
        return 'tag-error';
      case 'SKIPPED':
        return 'tag-warning';
      default:
        return 'tag-blue';
    }
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms} мс`;
    return `${(ms / 1000).toFixed(2)} с`;
  };

  const toggleStep = (stepIndex) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepIndex]: !prev[stepIndex]
    }));
  };

  return (
    <div className="page">
      <div className="card execution-card">
        <div className="card-header">
          <h2>Выполнение тестов</h2>
        </div>
        <div className="card-body">
          {/* Загрузка файлов */}
          <div className="upload-section">
            <h3>1. Загрузка данных</h3>
            <div className="file-upload-grid">
              <div className="file-upload">
                <label className="form-label">BPMN Процесс</label>
                <input
                  type="file"
                  accept=".bpmn,.xml"
                  onChange={handleBpmnUpload}
                  id="bpmn-upload-exec"
                />
                <label htmlFor="bpmn-upload-exec" className="btn">
                  {bpmnFile ? '✓ Файл загружен' : 'Загрузить BPMN'}
                </label>
              </div>

              <div className="file-upload">
                <label className="form-label">Результат маппинга</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleMappingUpload}
                  id="mapping-upload"
                />
                <label htmlFor="mapping-upload" className="btn">
                  {mappingResult ? '✓ Файл загружен' : 'Загрузить маппинг'}
                </label>
              </div>

              <div className="file-upload">
                <label className="form-label">Тестовые данные</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleTestDataUpload}
                  id="testdata-upload"
                />
                <label htmlFor="testdata-upload" className="btn">
                  {testData ? `✓ Файл загружен (${testData.variants?.length || 0} вариантов)` : 'Загрузить тестовые данные'}
                </label>
              </div>
            </div>
          </div>

          {/* Конфигурация */}
          <div className="config-section">
            <h3>2. Конфигурация окружения</h3>
            <div className="config-grid">
              <div className="form-group">
                <label className="form-label">Base URL *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="https://api.example.com"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Тип аутентификации</label>
                <select
                  className="form-control"
                  value={config.authType}
                  onChange={(e) => setConfig({ ...config, authType: e.target.value })}
                >
                  <option value="NONE">Нет</option>
                  <option value="BASIC">Basic Auth</option>
                  <option value="BEARER">Bearer Token</option>
                  <option value="API_KEY">API Key</option>
                </select>
              </div>

              {config.authType === 'BASIC' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={config.authUsername}
                      onChange={(e) => setConfig({ ...config, authUsername: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={config.authPassword}
                      onChange={(e) => setConfig({ ...config, authPassword: e.target.value })}
                    />
                  </div>
                </>
              )}

              {config.authType === 'BEARER' && (
                <div className="form-group">
                  <label className="form-label">Token</label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.authValue}
                    onChange={(e) => setConfig({ ...config, authValue: e.target.value })}
                  />
                </div>
              )}

              {config.authType === 'API_KEY' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Header Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="X-API-Key"
                      value={config.authHeaderName}
                      onChange={(e) => setConfig({ ...config, authHeaderName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">API Key</label>
                    <input
                      type="text"
                      className="form-control"
                      value={config.authValue}
                      onChange={(e) => setConfig({ ...config, authValue: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Request Timeout (мс)</label>
                <input
                  type="number"
                  className="form-control"
                  value={config.requestTimeoutMs}
                  onChange={(e) => setConfig({ ...config, requestTimeoutMs: parseInt(e.target.value) || 30000 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Connection Timeout (мс)</label>
                <input
                  type="number"
                  className="form-control"
                  value={config.connectionTimeoutMs}
                  onChange={(e) => setConfig({ ...config, connectionTimeoutMs: parseInt(e.target.value) || 10000 })}
                />
              </div>
            </div>
          </div>

          {/* Параметры выполнения */}
          <div className="execution-options">
            <h3>3. Параметры выполнения</h3>
            <div className="options-grid">
              {testData && testData.variants && testData.variants.length > 1 && (
                <div className="form-group">
                  <label className="form-label">Вариант тестовых данных</label>
                  <select
                    className="form-control"
                    value={variantIndex}
                    onChange={(e) => setVariantIndex(parseInt(e.target.value))}
                  >
                    {testData.variants.map((_, idx) => (
                      <option key={idx} value={idx}>
                        Вариант {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  <input
                    type="checkbox"
                    checked={stopOnFirstError}
                    onChange={(e) => setStopOnFirstError(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  Остановить при первой ошибке
                </label>
              </div>
            </div>
          </div>

          {/* Кнопка запуска */}
          <div className="actions">
            <button
              className="btn btn-primary btn-large"
              onClick={handleExecute}
              disabled={loading || !bpmnFile || !mappingResult || !testData || !config.baseUrl}
            >
              {loading ? '⏳ Выполнение...' : '▶️ Запустить тест'}
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Результаты выполнения */}
          {executionResult && (
            <div className="execution-result">
              <h3>Результаты выполнения</h3>

              {/* Общая статистика */}
              <div className="result-header">
                <div className="result-status">
                  <span className={`tag ${getStatusClass(executionResult.status)}`}>
                    {executionResult.status === 'SUCCESS' ? '✓ Успешно' : 
                     executionResult.status === 'FAILED' ? '✗ Ошибка' : 
                     '⚠ Частично успешно'}
                  </span>
                  <span className="result-duration">
                    Время выполнения: {formatDuration(executionResult.totalDurationMs)}
                  </span>
                </div>
                {executionResult.statistics && (
                  <div className="result-stats">
                    <div className="stat-item">
                      <span>Всего шагов:</span>
                      <strong>{executionResult.statistics.totalSteps}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Успешных:</span>
                      <strong className="stat-success">{executionResult.statistics.successfulSteps}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Ошибок:</span>
                      <strong className="stat-error">{executionResult.statistics.failedSteps}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Пропущено:</span>
                      <strong>{executionResult.statistics.skippedSteps}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Детали шагов */}
              {executionResult.steps && executionResult.steps.length > 0 && (
                <div className="steps-details">
                  <h4>Детали шагов</h4>
                  {executionResult.steps.map((step, index) => (
                    <div key={index} className="step-detail">
                      <div className="step-header" onClick={() => toggleStep(index)}>
                        <div className="step-info">
                          <span className="step-number">{index + 1}</span>
                          <div>
                            <strong>{step.taskName || step.taskId}</strong>
                            <div className="step-meta">
                              <span>Длительность: {formatDuration(step.durationMs)}</span>
                              {step.response && (
                                <span>Status: {step.response.statusCode}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="step-status">
                          <span className={`tag ${getStepStatusClass(step.status)}`}>
                            {step.status === 'SUCCESS' ? '✓ Успешно' : 
                             step.status === 'FAILED' ? '✗ Ошибка' : 
                             '⊘ Пропущено'}
                          </span>
                          <span className="toggle-icon">
                            {expandedSteps[index] ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>

                      {expandedSteps[index] && (
                        <div className="step-content">
                          {step.request && (
                            <div className="step-section">
                              <h5>Request</h5>
                              <div className="request-details">
                                <div><strong>URL:</strong> {step.request.url}</div>
                                <div><strong>Method:</strong> {step.request.method}</div>
                                {step.request.headers && Object.keys(step.request.headers).length > 0 && (
                                  <div>
                                    <strong>Headers:</strong>
                                    <pre>{JSON.stringify(step.request.headers, null, 2)}</pre>
                                  </div>
                                )}
                                {step.request.body && (
                                  <div>
                                    <strong>Body:</strong>
                                    <pre>{step.request.body}</pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {step.response && (
                            <div className="step-section">
                              <h5>Response</h5>
                              <div className="response-details">
                                <div><strong>Status Code:</strong> {step.response.statusCode}</div>
                                <div><strong>Response Time:</strong> {formatDuration(step.response.responseTimeMs)}</div>
                                {step.response.body && (
                                  <div>
                                    <strong>Body:</strong>
                                    <pre>{step.response.body.length > 500 
                                      ? step.response.body.substring(0, 500) + '...' 
                                      : step.response.body}</pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {step.validation && (
                            <div className="step-section">
                              <h5>Валидация</h5>
                              <div className={`validation-result ${step.validation.isValid ? 'valid' : 'invalid'}`}>
                                <div>
                                  <strong>Результат:</strong>{' '}
                                  <span className={step.validation.isValid ? 'text-success' : 'text-error'}>
                                    {step.validation.isValid ? '✓ Валидация пройдена' : '✗ Валидация не пройдена'}
                                  </span>
                                </div>
                                {step.validation.errors && step.validation.errors.length > 0 && (
                                  <div>
                                    <strong>Ошибки:</strong>
                                    <ul>
                                      {step.validation.errors.map((err, idx) => (
                                        <li key={idx} className="text-error">{err}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {step.validation.warnings && step.validation.warnings.length > 0 && (
                                  <div>
                                    <strong>Предупреждения:</strong>
                                    <ul>
                                      {step.validation.warnings.map((warn, idx) => (
                                        <li key={idx} className="text-warning">{warn}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {step.errorMessage && (
                            <div className="step-section">
                              <h5>Ошибка</h5>
                              <div className="error-details text-error">
                                {step.errorMessage}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Проблемы */}
              {executionResult.problems && executionResult.problems.length > 0 && (
                <div className="problems-section">
                  <h4>Выявленные проблемы</h4>
                  {executionResult.problems.map((problem, index) => (
                    <div key={index} className="problem-item">
                      <div className="problem-header">
                        <span className={`tag ${problem.severity === 'ERROR' ? 'tag-error' : 'tag-warning'}`}>
                          {problem.type}
                        </span>
                        <strong>{problem.stepName || problem.stepId}</strong>
                      </div>
                      <div className="problem-message">{problem.message}</div>
                      {problem.details && (
                        <div className="problem-details">
                          <pre>{problem.details}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

