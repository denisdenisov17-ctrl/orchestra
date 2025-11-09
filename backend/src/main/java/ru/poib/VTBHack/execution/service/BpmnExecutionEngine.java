package ru.poib.VTBHack.execution.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.poib.VTBHack.mapping.model.DataFlowEdge;
import ru.poib.VTBHack.mapping.model.MappingResult;
import ru.poib.VTBHack.parser.model.ProcessModel;
import ru.poib.VTBHack.parser.model.ProcessTask;

import java.util.*;

/**
 * Упрощенный движок для выполнения BPMN логики
 * Обрабатывает последовательное выполнение шагов согласно графу процесса
 */
@Slf4j
@Service
public class BpmnExecutionEngine {
    
    /**
     * Определяет порядок выполнения задач на основе графа процесса
     * 
     * @param processModel модель процесса
     * @param mappingResult результат маппинга
     * @return упорядоченный список ID задач для выполнения
     */
    public List<String> determineExecutionOrder(ProcessModel processModel, MappingResult mappingResult) {
        Map<String, ProcessTask> taskMap = new HashMap<>();
        for (ProcessTask task : processModel.getTasks()) {
            taskMap.put(task.getId(), task);
        }
        
        // Строим граф зависимостей
        Map<String, List<String>> dependencies = new HashMap<>();
        Map<String, Integer> inDegree = new HashMap<>();
        
        // Инициализация
        for (ProcessTask task : processModel.getTasks()) {
            dependencies.put(task.getId(), new ArrayList<>());
            inDegree.put(task.getId(), 0);
        }
        
        // Добавляем зависимости из sequence flows
        if (processModel.getSequenceFlows() != null) {
            for (Map.Entry<String, String> flow : processModel.getSequenceFlows().entrySet()) {
                String sourceId = flow.getKey();
                String targetId = flow.getValue();
                
                if (taskMap.containsKey(sourceId) && taskMap.containsKey(targetId)) {
                    dependencies.get(sourceId).add(targetId);
                    inDegree.put(targetId, inDegree.get(targetId) + 1);
                }
            }
        }
        
        // Топологическая сортировка (Kahn's algorithm)
        List<String> executionOrder = new ArrayList<>();
        Queue<String> queue = new LinkedList<>();
        
        // Находим задачи без входящих зависимостей (стартовые задачи)
        for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.offer(entry.getKey());
            }
        }
        
        // Если нет явных стартовых задач, начинаем с первой задачи
        if (queue.isEmpty() && !processModel.getTasks().isEmpty()) {
            queue.offer(processModel.getTasks().get(0).getId());
        }
        
        while (!queue.isEmpty()) {
            String currentTaskId = queue.poll();
            executionOrder.add(currentTaskId);
            
            // Уменьшаем in-degree для зависимых задач
            for (String dependentTaskId : dependencies.get(currentTaskId)) {
                int newInDegree = inDegree.get(dependentTaskId) - 1;
                inDegree.put(dependentTaskId, newInDegree);
                if (newInDegree == 0) {
                    queue.offer(dependentTaskId);
                }
            }
        }
        
        // Если остались задачи, которые не были обработаны, добавляем их в конец
        for (ProcessTask task : processModel.getTasks()) {
            if (!executionOrder.contains(task.getId())) {
                executionOrder.add(task.getId());
            }
        }
        
        log.debug("Determined execution order: {}", executionOrder);
        return executionOrder;
    }
    
    /**
     * Получает зависимости данных для задачи
     * 
     * @param taskId ID задачи
     * @param mappingResult результат маппинга
     * @return список DataFlowEdge, где текущая задача является target
     */
    public List<DataFlowEdge> getDataDependencies(String taskId, MappingResult mappingResult) {
        List<DataFlowEdge> dependencies = new ArrayList<>();
        
        if (mappingResult.getDataFlowEdges() != null) {
            for (DataFlowEdge edge : mappingResult.getDataFlowEdges()) {
                if (taskId.equals(edge.getTargetTaskId())) {
                    dependencies.add(edge);
                }
            }
        }
        
        return dependencies;
    }
    
    /**
     * Определяет, должна ли задача быть выполнена на основе условий gateway
     * В упрощенной версии всегда возвращает true
     * 
     * @param taskId ID задачи
     * @param context контекст выполнения
     * @return true, если задача должна быть выполнена
     */
    public boolean shouldExecuteTask(String taskId, Map<String, Object> context) {
        // В упрощенной версии всегда выполняем задачу
        // В полной версии здесь была бы логика для exclusive/parallel gateways
        return true;
    }
}

