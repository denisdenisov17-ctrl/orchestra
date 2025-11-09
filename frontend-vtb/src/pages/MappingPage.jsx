import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import '../styles/components/mapping.css';

export default function MappingPage() {
  const [bpmnFile, setBpmnFile] = useState(null);
  const [openApiFile, setOpenApiFile] = useState(null);
  const [mappingResult, setMappingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  // Generator states
  const [generationType, setGenerationType] = useState('CLASSIC');
  const [variantsCount, setVariantsCount] = useState(1);
  const [scenario, setScenario] = useState('positive');
  const [generationResult, setGenerationResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [previewJson, setPreviewJson] = useState(null);
  const [showPreviewRaw, setShowPreviewRaw] = useState(false);
  // Per-task custom request overrides (taskId -> object)
  const [overridesMap, setOverridesMap] = useState({});
  const [overridesRaw, setOverridesRaw] = useState({});
  const [openEdit, setOpenEdit] = useState({});
  // Draft JSON per taskId for editor view
  const [overridesDraft, setOverridesDraft] = useState({});

  // Parsed OpenAPI object (if user uploaded JSON OpenAPI)
  const parsedOpenApi = (() => {
    if (!openApiFile) return null;
    try {
      return JSON.parse(openApiFile);
    } catch (e) {
      return null;
    }
  })();

  const findOperationSchema = (mapping) => {
    if (!parsedOpenApi || !mapping) return null;
    const paths = parsedOpenApi.paths || {};
    const pathKeys = Object.keys(paths);
    let pathKey = mapping.endpointPath;
    if (!paths[pathKey]) {
      // try to find by template
      for (const key of pathKeys) {
        // convert template to regex
        const regex = '^' + key.replace(/\{[^}]+\}/g, '[^/]+') + '$';
        try {
          if (new RegExp(regex).test(mapping.endpointPath)) {
            pathKey = key;
            break;
          }
        } catch (err) {
          // ignore
        }
      }
    }

    const pathItem = paths[pathKey];
    if (!pathItem) return null;

    const method = (mapping.endpointMethod || 'get').toLowerCase();
    const operation = pathItem[method];
    if (!operation) return null;

    const schemaInfo = { parameters: [], requestBody: null };

    if (operation.parameters && Array.isArray(operation.parameters)) {
      for (const p of operation.parameters) {
        schemaInfo.parameters.push({ name: p.name, in: p.in, description: p.description, required: p.required, schema: p.schema });
      }
    }

    if (operation.requestBody && operation.requestBody.content) {
      const jsonMt = operation.requestBody.content['application/json'] || Object.values(operation.requestBody.content)[0];
      if (jsonMt && jsonMt.schema) {
        // try to extract properties
        const s = jsonMt.schema;
        if (s.properties) {
          const requiredProps = Array.isArray(s.required) ? s.required : [];
          schemaInfo.requestBody = { properties: s.properties, requiredProps };
        } else {
          schemaInfo.requestBody = { schema: s };
        }
      }
    }

    return schemaInfo;
  };

  const handleBpmnUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setBpmnFile(e.target.result);
      reader.readAsText(file);
    }
  };

  const handleOpenApiUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setOpenApiFile(e.target.result);
      reader.readAsText(file);
    }
  };

  const handleMap = async () => {
    if (!bpmnFile || !openApiFile) {
      setError('Пожалуйста, загрузите оба файла: BPMN и OpenAPI');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mapping/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          bpmnXml: bpmnFile,
          openApiJson: openApiFile
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка при сопоставлении');
      }

      const result = await response.json();
      setMappingResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async () => {
    if (!bpmnFile || !openApiFile) {
      setError('Пожалуйста, загрузите оба файла: BPMN и OpenAPI');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mapping/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          bpmnXml: bpmnFile,
          openApiJson: openApiFile,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при получении рекомендаций');
      }

      const result = await response.json();
      setMappingResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!mappingResult) return;
    const dataStr = JSON.stringify(mappingResult, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mapping-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!mappingResult) {
      setError('Сначала выполните сопоставление процесса и API (Map)');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Merge overrides into a shallow copy of mappingResult
      const payloadMapping = mappingResult ? { ...mappingResult, taskMappings: { ...(mappingResult.taskMappings || {}) } } : {};
      Object.keys(overridesMap).forEach(taskId => {
        if (payloadMapping.taskMappings && payloadMapping.taskMappings[taskId]) {
          payloadMapping.taskMappings[taskId] = { ...payloadMapping.taskMappings[taskId], customRequestData: overridesMap[taskId] };
        }
      });

      const body = {
        generationType: generationType,
        mappingResult: payloadMapping,
        openApiModel: parsedOpenApi,
        scenario: scenario,
        variantsCount: Number(variantsCount)
      };

      const response = await fetch('/api/generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Ошибка при генерации тестовых данных');

      const res = await response.json();
      setGenerationResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadGeneration = () => {
    if (!generationResult) return;
    const dataStr = JSON.stringify(generationResult, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-data-generation-result.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePreviewJson = () => {
    if (!mappingResult) {
      setError('Сначала выполните сопоставление процесса и API (Map)');
      return;
    }

    try {
      const tasks = mappingResult.taskMappings
        ? Object.entries(mappingResult.taskMappings).map(([taskId, m]) => {
          const method = m.method || m.endpointMethod || m.endpoint_method || '';
          const path = m.path || m.endpointPath || m.endpoint_path || '';
            const schema = findOperationSchema(m) || {};
            const paramFields = (schema.parameters || []).map(p => ({
              name: p.name,
              in: p.in,
              type: p?.schema?.type,
              required: !!p.required,
              description: p.description,
            }));
            let bodyFields = null;
            if (schema.requestBody && schema.requestBody.properties) {
              const reqSet = new Set(schema.requestBody.requiredProps || []);
              bodyFields = Object.entries(schema.requestBody.properties).map(([k, v]) => ({
                name: k,
                type: v.type,
                required: reqSet.has(k),
                description: v.description,
              }));
            }

            return {
              taskId,
              taskName: m.taskName,
              method,
              path,
              requiredFields: {
                parameters: paramFields,
                body: bodyFields,
              },
            };
          })
        : [];

      const preview = {
        generationType: generationType,
        scenario: scenario,
        variantsCount: Number(variantsCount),
        variants: [tasks],
      };

      setPreviewJson(preview);
      setShowPreviewRaw(true);
    } catch (err) {
      setError('Ошибка подготовки предпросмотра JSON: ' + (err?.message || String(err)));
    }
  };

  const downloadPreview = () => {
    if (!previewJson) return;
    const dataStr = JSON.stringify(previewJson, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generation-preview.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="card mapping-card">
        <div className="card-header">
          <h2>Сопоставление процессов с API</h2>
        </div>
        <div className="card-body">
          <div className="upload-section">
            <div className="file-upload">
              <h3>BPMN Процесс</h3>
              <input 
                type="file" 
                accept=".bpmn,.xml" 
                onChange={handleBpmnUpload}
                id="bpmn-upload"
              />
              <label htmlFor="bpmn-upload" className="btn">
                Загрузить BPMN файл
              </label>
              {bpmnFile && <span className="file-name">✓ Файл загружен</span>}
            </div>

            <div className="file-upload">
              <h3>OpenAPI Спецификация</h3>
              <input 
                type="file" 
                accept=".json,.yaml,.yml" 
                onChange={handleOpenApiUpload}
                id="openapi-upload"
              />
              <label htmlFor="openapi-upload" className="btn">
                Загрузить OpenAPI файл
              </label>
              {openApiFile && <span className="file-name">✓ Файл загружен</span>}
            </div>
          </div>

          <div className="actions">
            <button 
              className="btn primary" 
              onClick={handleMap}
              disabled={loading || !bpmnFile || !openApiFile}
            >
              {loading ? 'Сопоставление...' : 'Сопоставить'}
            </button>
            <button 
              className="btn secondary" 
              onClick={getRecommendations}
              disabled={loading || !bpmnFile || !openApiFile}
            >
              Получить рекомендации
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {mappingResult && (
            <div className="mapping-result">
              <h3>Результаты сопоставления</h3>
              <div className="report-actions" style={{display: 'flex', gap: '12px', marginBottom: 12}}>
                <button className="btn" onClick={() => setShowRaw(s => !s)}>
                  {showRaw ? 'Скрыть исходный JSON' : 'Показать полный JSON'}
                </button>
                <button className="btn" onClick={downloadReport}>Скачать JSON</button>
              </div>
              {showRaw && (
                <pre style={{maxHeight: 360, overflow: 'auto', background: '#0f1720', color: '#e6eef8', padding: 12, borderRadius: 6}}>
                  {JSON.stringify(mappingResult, null, 2)}
                </pre>
              )}
              <div className="stats">
                <div className="stat-item">
                  <span>Всего задач:</span>
                  <strong>{mappingResult.totalTasks}</strong>
                </div>
                <div className="stat-item">
                  <span>Сопоставлено:</span>
                  <strong>{mappingResult.matchedTasks}</strong>
                </div>
                <div className="stat-item">
                  <span>Уверенность:</span>
                  <strong>{(mappingResult.overallConfidence * 100).toFixed(1)}%</strong>
                </div>
              </div>

              <div className="mappings">
                <h4>Сопоставленные задачи</h4>
                <div className="mapping-list">
                  {mappingResult.taskMappings && Object.entries(mappingResult.taskMappings).map(([taskId, mapping]) => {
                    const method = mapping.method || mapping.endpointMethod || mapping.endpoint_method || '';
                    const path = mapping.path || mapping.endpointPath || mapping.endpoint_path || '';
                    const confidence = (mapping.confidence !== undefined ? mapping.confidence : mapping.confidenceScore !== undefined ? mapping.confidenceScore : mapping.score);
                    const operationId = mapping.operationId || mapping.operation_id || '';
                    const matchingStrategy = mapping.matchingStrategy || mapping.matching_strategy || mapping.strategy || '';
                    const recommendation = mapping.recommendation || mapping.recommendationText || mapping.note || '';

                    return (
                      <div key={taskId} className="mapping-item">
                        <div className="task-info">
                          <strong>{mapping.taskName}</strong>
                          <span className="confidence">
                            {(Number(confidence || 0) * 100).toFixed(1)}% уверенность
                          </span>
                          <div style={{fontSize:12, color:'#666'}}>{matchingStrategy ? `Стратегия: ${matchingStrategy}` : ''}</div>
                          {recommendation && <div style={{fontSize:12, color:'#444', marginTop:6}}>Рекомендация: {recommendation}</div>}
                        </div>
                        <div className="route-info" style={{width:'100%'}}>
                          <div className="endpoint-info">
                            <span className="method">{method}</span>
                            <span className="path">{path}</span>
                            <div style={{fontSize:12, color:'#666', marginLeft:12}}>{operationId}</div>
                          </div>
                        </div>

                        <div className="edit-block" style={{width:'100%'}}>
                          <div style={{display:'flex', gap:8, alignItems:'center', marginLeft:0}}>
                            <button className="btn" onClick={() => {
                              const open = openEdit[taskId];
                              // toggle
                              setOpenEdit({ ...openEdit, [taskId]: !open });
                              if (!open) {
                                // initialize raw text if opening
                                const initial = overridesMap[taskId] || {};
                                setOverridesRaw({ ...overridesRaw, [taskId]: JSON.stringify(initial, null, 2) });
                                setOverridesDraft({ ...overridesDraft, [taskId]: initial });
                              }
                            }}>
                              {openEdit[taskId] ? 'Закрыть редактирование' : 'Редактировать request'}
                            </button>
                            <button className="btn" onClick={() => {
                              // clear overrides for this task
                              const copy = { ...overridesMap };
                              delete copy[taskId];
                              setOverridesMap(copy);
                              setOverridesRaw({ ...overridesRaw, [taskId]: '{}' });
                              setOverridesDraft({ ...overridesDraft, [taskId]: {} });
                            }}>Очистить</button>
                          </div>
                          {openEdit[taskId] && (
                            <div style={{marginTop:8, width:'100%'}}>
                              {/* show schema hints if available */}
                              {openApiFile && !parsedOpenApi && (
                                <div style={{fontSize:12, color:'#a33', marginBottom:6}}>Нельзя разобрать OpenAPI: загрузите JSON OpenAPI, чтобы увидеть структуру requestData.</div>
                              )}
                              {parsedOpenApi && (
                                (() => {
                                  const schema = findOperationSchema(mapping);
                                  if (!schema) return <div style={{fontSize:12, color:'#666', marginBottom:6}}>Схема запроса не найдена для этого эндпоинта.</div>;
                                  return (
                                    <div className="schema-box" style={{marginBottom:8, padding:8, background:'#f6f8fa', borderRadius:6}}>
                                      <div style={{fontWeight:600, marginBottom:6}}>Схема requestData (подсказка)</div>
                                      {schema.parameters && schema.parameters.length > 0 && (
                                        <div style={{marginBottom:6}}>
                                          <div style={{fontSize:13, fontWeight:600}}>Параметры запроса:</div>
                                          <ul style={{marginTop:6}}>
                                            {schema.parameters.map((p, i) => (
                                              <li key={i} style={{fontSize:13}}>{p.name} ({p.in}){p.required ? ' — required' : ''}{p.description ? ` — ${p.description}` : ''}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {schema.requestBody && schema.requestBody.properties && (
                                        <div>
                                          <div style={{fontSize:13, fontWeight:600}}>Тело (application/json) — свойства:</div>
                                          <ul style={{marginTop:6}}>
                                            {Object.entries(schema.requestBody.properties).map(([k, v]) => (
                                              <li key={k} style={{fontSize:13}}>{k}{v.type ? `: ${v.type}` : ''}{v.description ? ` — ${v.description}` : ''}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {schema.requestBody && schema.requestBody.schema && (
                                        <div style={{fontSize:13}}>Схема: <pre style={{display:'inline', marginLeft:6}}>{JSON.stringify(schema.requestBody.schema, null, 2)}</pre></div>
                                      )}
                                    </div>
                                  );
                                })()
                              )}

                              <div style={{fontSize:12, color:'#666', marginBottom:6}}>Отредактируйте JSON ниже (остальные поля будут сгенерированы):</div>
                              <div style={{border:'1px solid #e1e4e8', borderRadius:6, overflow:'hidden'}}>
                                <Editor
                                  height="220px"
                                  defaultLanguage="json"
                                  theme="vs-dark"
                                  value={overridesRaw[taskId] || JSON.stringify(overridesDraft[taskId] || {}, null, 2)}
                                  onChange={(val) => {
                                    const text = typeof val === 'string' ? val : (val || '');
                                    setOverridesRaw({ ...overridesRaw, [taskId]: text });
                                    try {
                                      const obj = JSON.parse(text || '{}');
                                      setOverridesDraft({ ...overridesDraft, [taskId]: obj });
                                    } catch {}
                                  }}
                                  options={{
                                    wordWrap: 'on',
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                  }}
                                />
                              </div>
                              <div style={{display:'flex', gap:8, marginTop:6}}>
                                <button className="btn" onClick={() => {
                                  try {
                                    const parsed = JSON.parse(overridesRaw[taskId] || JSON.stringify(overridesDraft[taskId] || {}));
                                    setOverridesMap({ ...overridesMap, [taskId]: parsed });
                                    setOpenEdit({ ...openEdit, [taskId]: false });
                                  } catch (err) {
                                    setError('Некорректный JSON: ' + err.message);
                                  }
                                }}>Сохранить</button>
                                <button className="btn" onClick={() => setOpenEdit({ ...openEdit, [taskId]: false })}>Отмена</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Unmatched tasks */}
              {mappingResult.unmatchedTasks && mappingResult.unmatchedTasks.length > 0 && (
                <div style={{marginTop:20}}>
                  <h4>Несопоставленные задачи ({mappingResult.unmatchedTasks.length})</h4>
                  <div className="mapping-list">
                    {mappingResult.unmatchedTasks.map(item => (
                      <div key={item.elementId} className="mapping-item">
                        <div>
                          <strong>{item.elementName}</strong>
                          <div style={{fontSize:12, color:'#666'}}>Тип: {item.elementType}</div>
                          {item.recommendations && item.recommendations.length > 0 && (
                            <ul style={{marginTop:8}}>
                              {item.recommendations.map((r, idx) => <li key={idx} style={{fontSize:13}}>{r}</li>)}
                            </ul>
                          )}
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:12, color:'#666'}}>Макс уверенность: {(item.maxConfidence * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Статистика по эндпоинтам */}
              <div style={{marginTop:20, fontSize:13, color:'#666'}}>
                Использовано {mappingResult.matchedEndpoints} из {mappingResult.totalEndpoints} доступных эндпоинтов
              </div>

              {mappingResult.dataFlowEdges && mappingResult.dataFlowEdges.length > 0 && (
                <div className="data-flow">
                  <h4>Поток данных</h4>
                  <div className="flow-list">
                    {mappingResult.dataFlowEdges.map((edge, index) => {
                      const source = edge.source || edge.sourceTaskId || edge.from || '';
                      const target = edge.target || edge.targetTaskId || edge.to || '';
                      const fields = edge.fields || edge.dataFields || [];
                      const confidence = edge.confidence !== undefined ? edge.confidence : edge.score || 0;

                      return (
                        <div key={index} className="flow-item">
                          <div>
                            <strong>{source} → {target}</strong>
                            {fields && fields.length > 0 && <div style={{fontSize:12, color:'#666'}}>Поля: {fields.join(', ')}</div>}
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:12, color:'#666'}}>{(Number(confidence) * 100).toFixed(1)}% уверенность</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generator UI */}
              <div style={{marginTop:20, padding:16, background:'#fff', borderRadius:8}}>
                <h4>Генерация тестовых данных</h4>
                <div style={{display:'flex', gap:12, alignItems:'center', marginTop:8}}>
                  <label style={{fontSize:13}}>Тип генерации:</label>
                  <select value={generationType} onChange={e => setGenerationType(e.target.value)}>
                    <option value="CLASSIC">CLASSIC</option>
                    <option value="AI">AI</option>
                  </select>
                  <label style={{fontSize:13}}>Сценарий:</label>
                  <select value={scenario} onChange={e => setScenario(e.target.value)}>
                    <option value="positive">positive</option>
                    <option value="negative">negative</option>
                    <option value="edge_case">edge_case</option>
                  </select>
                  <label style={{fontSize:13}}>Варианты:</label>
                  <input type="number" min={1} value={variantsCount} onChange={e => setVariantsCount(e.target.value)} style={{width:80}} />
                  <button className="btn" onClick={handlePreviewJson} disabled={!mappingResult}>Предпросмотр JSON</button>
                  <button className="btn primary" onClick={handleGenerate} disabled={generating}>{generating ? 'Генерация...' : 'Генерировать'}</button>
                  <button className="btn" onClick={downloadGeneration} disabled={!generationResult}>Скачать результат</button>
                </div>

                {previewJson && (
                  <div style={{marginTop:12}}>
                    <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:8}}>
                      <span style={{fontSize:13, color:'#333'}}>Предпросмотр JSON запроса</span>
                      <button className="btn" onClick={() => setShowPreviewRaw(s => !s)}>
                        {showPreviewRaw ? 'Скрыть' : 'Показать'}
                      </button>
                      <button className="btn" onClick={downloadPreview}>Скачать JSON</button>
                    </div>
                    {showPreviewRaw && (
                      <pre style={{maxHeight:260, overflow:'auto', background:'#0b1220', color:'#e6eef8', padding:12, borderRadius:6}}>
                        {JSON.stringify(previewJson, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {generationResult && (
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:13, color:'#333'}}>Тип: {generationResult.generationType}</div>
                    <div style={{fontSize:13, color:'#333'}}>Сценарий: {generationResult.scenario}</div>
                    <div style={{fontSize:13, color:'#333'}}>Вариантов: {generationResult.variants ? generationResult.variants.length : 0}</div>
                    <div style={{marginTop:8}}>
                      <pre style={{maxHeight:260, overflow:'auto', background:'#0b1220', color:'#e6eef8', padding:12, borderRadius:6}}>
                        {JSON.stringify(generationResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}