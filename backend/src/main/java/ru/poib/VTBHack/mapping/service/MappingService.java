package ru.poib.VTBHack.mapping.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import ru.poib.VTBHack.mapping.model.*;
import ru.poib.VTBHack.parser.model.ProcessModel;
import ru.poib.VTBHack.parser.model.ProcessTask;
import ru.poib.VTBHack.parser.model.openapi.OpenApiModel;

import java.util.*;

/**
 * Основной сервис для автоматического сопоставления задач процесса с API эндпоинтами.
 * Фокусируется на сопоставлении всех BPMN задач с API эндпоинтами.
 */
@Service
public class MappingService {
    
    private final EndpointExtractor endpointExtractor;
    private final SemanticAnalysisService semanticAnalysisService;
    private final DataFlowAnalyzer dataFlowAnalyzer;
    private final OpenApiDependencyAnalyzer openApiDependencyAnalyzer;
    
    // Пороги уверенности для различных стратегий
    private static final double EXACT_MATCH_THRESHOLD = 0.95;
    private static final double SEMANTIC_MATCH_THRESHOLD = 0.4; // Снижен для увеличения вероятности сопоставления BPMN задач
    private static final double MIN_CONFIDENCE_THRESHOLD = 0.3; // Снижен для увеличения вероятности сопоставления BPMN задач
    
    @Autowired
    public MappingService(EndpointExtractor endpointExtractor,
                          SemanticAnalysisService semanticAnalysisService,
                          DataFlowAnalyzer dataFlowAnalyzer,
                          OpenApiDependencyAnalyzer openApiDependencyAnalyzer) {
        this.endpointExtractor = endpointExtractor;
        this.semanticAnalysisService = semanticAnalysisService;
        this.dataFlowAnalyzer = dataFlowAnalyzer;
        this.openApiDependencyAnalyzer = openApiDependencyAnalyzer;
    }

    // Backward-compatible constructor for tests/manual usage
    public MappingService(EndpointExtractor endpointExtractor,
                          SemanticAnalysisService semanticAnalysisService,
                          DataFlowAnalyzer dataFlowAnalyzer) {
        this(endpointExtractor, semanticAnalysisService, dataFlowAnalyzer, new OpenApiDependencyAnalyzer());
    }
    
    /**
     * Выполняет сопоставление задач процесса с API эндпоинтами.
     * Главная цель - найти соответствия для всех задач BPMN.
     * Эндпоинты OpenAPI, не сопоставленные с задачами, игнорируются.
     */
    public MappingResult mapProcessToEndpoints(ProcessModel processModel, OpenApiModel openApiModel) {
        // Извлекаем эндпоинты из OpenAPI
        List<EndpointInfo> endpoints = endpointExtractor.extractEndpoints(openApiModel);
        
        // Создаем маппинг для каждой задачи
        Map<String, TaskEndpointMapping> taskMappings = new HashMap<>();
        List<UnmatchedElement> unmatchedTasks = new ArrayList<>();
        Set<String> matchedEndpointIds = new HashSet<>();
        
        // Сначала пробуем найти точные совпадения
        for (ProcessTask task : processModel.getTasks()) {
            TaskEndpointMapping exactMatch = tryExactMatch(task, endpoints);
            if (exactMatch != null && exactMatch.getConfidenceScore() >= EXACT_MATCH_THRESHOLD) {
                taskMappings.put(task.getId(), exactMatch);
                matchedEndpointIds.add(exactMatch.getEndpointPath() + ":" + exactMatch.getEndpointMethod());
                continue;
            }
            
            // Если точного совпадения нет, ищем наилучшее возможное
            TaskEndpointMapping mapping = findBestMatch(task, endpoints);
            if (mapping != null && mapping.getConfidenceScore() >= MIN_CONFIDENCE_THRESHOLD) {
                taskMappings.put(task.getId(), mapping);
                matchedEndpointIds.add(mapping.getEndpointPath() + ":" + mapping.getEndpointMethod());
            } else {
                UnmatchedElement unmatched = createUnmatchedTask(task, endpoints);
                unmatchedTasks.add(unmatched);
            }
        }
        
        // Анализируем поток данных на основе последовательности задач
        List<DataFlowEdge> dataFlowEdges = dataFlowAnalyzer.analyzeDataFlow(processModel, taskMappings);

        // Дополнительно: анализируем зависимости из описаний OpenAPI и добавляем ребра
        List<DataFlowEdge> dependencyEdges = buildEdgesFromOpenApiDependencies(taskMappings, openApiModel);
        // Избегаем дубликатов
        for (DataFlowEdge de : dependencyEdges) {
            boolean exists = dataFlowEdges.stream().anyMatch(e ->
                    Objects.equals(e.getSourceTaskId(), de.getSourceTaskId()) &&
                    Objects.equals(e.getTargetTaskId(), de.getTargetTaskId()) &&
                    Objects.equals(e.getFields(), de.getFields()));
            if (!exists) {
                dataFlowEdges.add(de);
            }
        }
        
        // Вычисляем статистику с фокусом на покрытии BPMN задач
        double overallConfidence = calculateBpmnTaskMatchingConfidence(taskMappings, processModel.getTasks().size());
        
        MappingResult result = new MappingResult();
        result.setTaskMappings(taskMappings);
        result.setDataFlowEdges(dataFlowEdges);
        result.setUnmatchedTasks(unmatchedTasks);
        result.setOverallConfidence(overallConfidence);
        result.setTotalTasks(processModel.getTasks().size());
        result.setMatchedTasks(taskMappings.size());
        // Эндпоинты отображаются только для информации, без списка несопоставленных
        result.setTotalEndpoints(endpoints.size());
        result.setMatchedEndpoints(matchedEndpointIds.size());
        
        return result;
    }
    
    /**
     * Находит лучшее сопоставление для задачи
     */
    private TaskEndpointMapping findBestMatch(ProcessTask task, List<EndpointInfo> endpoints) {
        TaskEndpointMapping bestMatch = null;
        double bestScore = 0.0;
        
        // Стратегия 1: Точное совпадение по operationId и task ID/name
        TaskEndpointMapping exactMatch = tryExactMatch(task, endpoints);
        if (exactMatch != null && exactMatch.getConfidenceScore() >= EXACT_MATCH_THRESHOLD) {
            return exactMatch;
        }
        if (exactMatch != null && exactMatch.getConfidenceScore() > bestScore) {
            bestMatch = exactMatch;
            bestScore = exactMatch.getConfidenceScore();
        }
        
        // Стратегия 2: Совпадение по custom properties (api.endpoint)
        TaskEndpointMapping customPropertyMatch = tryCustomPropertyMatch(task, endpoints);
        if (customPropertyMatch != null && customPropertyMatch.getConfidenceScore() > bestScore) {
            bestMatch = customPropertyMatch;
            bestScore = customPropertyMatch.getConfidenceScore();
        }
        
        // Стратегия 3: Совпадение по описанию (summary/description)
        TaskEndpointMapping descriptionMatch = tryDescriptionMatch(task, endpoints);
        if (descriptionMatch != null && descriptionMatch.getConfidenceScore() > bestScore) {
            bestMatch = descriptionMatch;
            bestScore = descriptionMatch.getConfidenceScore();
        }
        
        // Стратегия 4: Семантический анализ
        TaskEndpointMapping semanticMatch = trySemanticMatch(task, endpoints);
        if (semanticMatch != null && semanticMatch.getConfidenceScore() > bestScore) {
            bestMatch = semanticMatch;
            bestScore = semanticMatch.getConfidenceScore();
        }
        
        return bestMatch;
    }
    
    /**
     * Стратегия 1: Точное совпадение по operationId и task ID/name
     */
    private TaskEndpointMapping tryExactMatch(ProcessTask task, List<EndpointInfo> endpoints) {
        String taskId = task.getId();
        String taskName = task.getName();
        
        for (EndpointInfo endpoint : endpoints) {
            // Проверяем совпадение operationId с task ID или name
            if (endpoint.getOperationId() != null) {
                if (endpoint.getOperationId().equalsIgnoreCase(taskId) ||
                    endpoint.getOperationId().equalsIgnoreCase(taskName)) {
                    return createMapping(task, endpoint, 1.0, "EXACT");
                }
            }
            
            // Проверяем совпадение path/method с именем задачи
            if (task.getApiEndpointInfo() != null) {
                String taskMethod = task.getApiEndpointInfo().getMethod();
                String taskPath = task.getApiEndpointInfo().getPath();
                
                if (taskMethod != null && taskPath != null &&
                    taskMethod.equalsIgnoreCase(endpoint.getMethod()) &&
                    taskPath.equals(endpoint.getPath())) {
                    return createMapping(task, endpoint, 0.95, "EXACT");
                }
            }
        }
        
        return null;
    }
    
    /**
     * Стратегия 2: Совпадение по custom properties
     */
    private TaskEndpointMapping tryCustomPropertyMatch(ProcessTask task, List<EndpointInfo> endpoints) {
        if (task.getCustomProperties() == null) {
            return null;
        }
        
        // Проверяем свойство api.endpoint
        String apiEndpoint = task.getCustomProperties().get("api.endpoint");
        if (apiEndpoint == null) {
            apiEndpoint = task.getCustomProperties().get("apiEndpoint");
        }
        
        if (apiEndpoint != null) {
            // Парсим "METHOD /path"
            String[] parts = apiEndpoint.trim().split("\\s+", 2);
            if (parts.length == 2) {
                String method = parts[0].toUpperCase();
                String path = parts[1];
                
                for (EndpointInfo endpoint : endpoints) {
                    if (endpoint.getMethod().equals(method) && endpoint.getPath().equals(path)) {
                        return createMapping(task, endpoint, 0.9, "CUSTOM_PROPERTY");
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * Создает дополнительные ребра потока данных на основе зависимостей из описаний OpenAPI.
     */
    private List<DataFlowEdge> buildEdgesFromOpenApiDependencies(Map<String, TaskEndpointMapping> taskMappings,
                                                                 OpenApiModel openApiModel) {
        List<DataFlowEdge> edges = new ArrayList<>();
        if (openApiModel == null || taskMappings == null || taskMappings.isEmpty()) {
            return edges;
        }

        // Индекс: endpointKey (METHOD:PATH) -> taskId
        Map<String, String> endpointToTask = new HashMap<>();
        taskMappings.forEach((taskId, mapping) -> {
            if (mapping != null && mapping.getEndpointMethod() != null && mapping.getEndpointPath() != null) {
                String key = mapping.getEndpointMethod().toUpperCase(Locale.ROOT) + ":" + mapping.getEndpointPath();
                endpointToTask.put(key, taskId);
            }
        });

        Map<String, List<OpenApiDependencyAnalyzer.OpenApiDependency>> depsByEndpoint =
                openApiDependencyAnalyzer.analyze(openApiModel);

        for (Map.Entry<String, List<OpenApiDependencyAnalyzer.OpenApiDependency>> entry : depsByEndpoint.entrySet()) {
            String targetEndpointKey = entry.getKey();
            String targetTaskId = endpointToTask.get(targetEndpointKey);
            if (targetTaskId == null) continue; // Текущий эндпоинт не сопоставлен ни с одной задачей

            for (OpenApiDependencyAnalyzer.OpenApiDependency dep : entry.getValue()) {
                String sourceEndpointKey = dep.method.toUpperCase(Locale.ROOT) + ":" + dep.path;
                String sourceTaskId = endpointToTask.get(sourceEndpointKey);
                if (sourceTaskId == null) continue; // Зависимый эндпоинт не сопоставлен ни с одной задачей

                List<String> fields = new ArrayList<>();
                if (dep.fieldHint != null && !dep.fieldHint.isBlank()) {
                    fields.add(dep.fieldHint);
                } else {
                    // Базовые поля, если явного указания нет
                    fields.add("data");
                }

                edges.add(new DataFlowEdge(sourceTaskId, targetTaskId, fields, dep.confidence));
            }
        }

        return edges;
    }
    
    /**
     * Стратегия 3: Совпадение по описанию
     */
    private TaskEndpointMapping tryDescriptionMatch(ProcessTask task, List<EndpointInfo> endpoints) {
        String taskDescription = buildTaskText(task);
        if (taskDescription == null || taskDescription.trim().isEmpty()) {
            return null;
        }
        
        TaskEndpointMapping bestMatch = null;
        double bestScore = 0.0;
        
        for (EndpointInfo endpoint : endpoints) {
            String endpointText = endpoint.getFullText();
            double similarity = semanticAnalysisService.calculateSimilarity(taskDescription, endpointText);
            
            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = createMapping(task, endpoint, similarity * 0.85, "DESCRIPTION");
            }
        }
        
        return bestMatch;
    }
    
    /**
     * Стратегия 4: Семантический анализ
     */
    private TaskEndpointMapping trySemanticMatch(ProcessTask task, List<EndpointInfo> endpoints) {
        String taskText = buildTaskText(task);
        if (taskText == null || taskText.trim().isEmpty()) {
            return null;
        }
        
        // Создаем словарь текстов эндпоинтов
        Map<String, String> endpointTexts = new HashMap<>();
        for (EndpointInfo endpoint : endpoints) {
            String key = endpoint.getPath() + ":" + endpoint.getMethod();
            endpointTexts.put(key, endpoint.getFullText());
        }
        
        // Находим наиболее похожий эндпоинт
        Map.Entry<String, Double> bestMatch = semanticAnalysisService.findMostSimilar(taskText, endpointTexts);
        
        if (bestMatch != null && bestMatch.getValue() >= SEMANTIC_MATCH_THRESHOLD) {
            String[] parts = bestMatch.getKey().split(":");
            String path = parts[0];
            String method = parts.length > 1 ? parts[1] : "";
            
            EndpointInfo endpoint = endpoints.stream()
                    .filter(e -> e.getPath().equals(path) && e.getMethod().equals(method))
                    .findFirst()
                    .orElse(null);
            
            if (endpoint != null) {
                return createMapping(task, endpoint, bestMatch.getValue(), "SEMANTIC");
            }
        }
        
        return null;
    }
    
    /**
     * Создает текст задачи для семантического анализа
     */
    private String buildTaskText(ProcessTask task) {
        StringBuilder sb = new StringBuilder();
        if (task.getName() != null) sb.append(task.getName()).append(" ");
        if (task.getDescription() != null) sb.append(task.getDescription()).append(" ");
        if (task.getApiEndpointInfo() != null && task.getApiEndpointInfo().getDescription() != null) {
            sb.append(task.getApiEndpointInfo().getDescription()).append(" ");
        }
        return sb.toString().trim();
    }
    
    /**
     * Создает объект сопоставления
     */
    private TaskEndpointMapping createMapping(ProcessTask task, EndpointInfo endpoint, 
                                              double confidence, String strategy) {
        TaskEndpointMapping mapping = new TaskEndpointMapping();
        mapping.setTaskId(task.getId());
        mapping.setTaskName(task.getName());
        mapping.setEndpointPath(endpoint.getPath());
        mapping.setEndpointMethod(endpoint.getMethod());
        mapping.setOperationId(endpoint.getOperationId());
        mapping.setConfidenceScore(confidence);
        mapping.setMatchingStrategy(strategy);
        mapping.setRecommendation(generateRecommendation(task, endpoint, confidence, strategy));
        return mapping;
    }
    
    /**
     * Генерирует рекомендацию для сопоставления
     */
    private String generateRecommendation(ProcessTask task, EndpointInfo endpoint, 
                                         double confidence, String strategy) {
        if (confidence >= 0.9) {
            return "Высокая уверенность в сопоставлении";
        } else if (confidence >= 0.7) {
            return "Средняя уверенность. Рекомендуется проверить вручную";
        } else {
            return "Низкая уверенность. Требуется ручная проверка";
        }
    }
    
    /**
     * Создает объект несопоставленной задачи
     */
    private UnmatchedElement createUnmatchedTask(ProcessTask task, List<EndpointInfo> endpoints) {
        UnmatchedElement unmatched = new UnmatchedElement();
        unmatched.setElementId(task.getId());
        unmatched.setElementName(task.getName());
        unmatched.setElementType("TASK");
        
        // Находим топ-3 наиболее похожих эндпоинта для рекомендаций
        String taskText = buildTaskText(task);
        List<String> recommendations = new ArrayList<>();
        
        if (taskText != null && !taskText.trim().isEmpty()) {
            Map<String, Double> similarities = new HashMap<>();
            for (EndpointInfo endpoint : endpoints) {
                double sim = semanticAnalysisService.calculateSimilarity(taskText, endpoint.getFullText());
                similarities.put(endpoint.getMethod() + " " + endpoint.getPath(), sim);
            }
            
            similarities.entrySet().stream()
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .limit(3)
                    .forEach(entry -> {
                        if (entry.getValue() > 0.3) {
                            recommendations.add("Возможный эндпоинт: " + entry.getKey() + 
                                              " (сходство: " + String.format("%.2f", entry.getValue()) + ")");
                        }
                    });
        }
        
        if (recommendations.isEmpty()) {
            recommendations.add("Не удалось найти похожие эндпоинты автоматически");
        }
        
        unmatched.setRecommendations(recommendations);
        unmatched.setMaxConfidence(recommendations.stream()
                .mapToDouble(r -> {
                    // Извлекаем значение сходства из рекомендации
                    if (r.contains("сходство: ")) {
                        try {
                            String scoreStr = r.substring(r.indexOf("сходство: ") + 10, r.indexOf(")"));
                            return Double.parseDouble(scoreStr.trim());
                        } catch (Exception e) {
                            return 0.0;
                        }
                    }
                    return 0.0;
                })
                .max()
                .orElse(0.0));
        
        return unmatched;
    }
    
    /**
     * Рассчитывает общую уверенность в сопоставлении с фокусом на покрытии BPMN задач
     * @param mappings Маппинг задач на эндпоинты
     * @param totalTasks Общее количество BPMN задач
     */
    private double calculateBpmnTaskMatchingConfidence(Map<String, TaskEndpointMapping> mappings, int totalTasks) {
        if (totalTasks == 0 || mappings.isEmpty()) {
            return 0.0;
        }
        
        // Средняя уверенность по сопоставленным задачам
        double avgConfidence = mappings.values().stream()
                .mapToDouble(TaskEndpointMapping::getConfidenceScore)
                .average()
                .orElse(0.0);
        
        // Процент покрытия BPMN задач
        double coverage = (double) mappings.size() / totalTasks;
        
        // Итоговая уверенность учитывает как качество сопоставления, так и покрытие задач
        // Делаем больший акцент на покрытии BPMN задач (60%) и меньший на уверенности сопоставления (40%)
        return (0.6 * coverage + 0.4 * avgConfidence);
    }
}

