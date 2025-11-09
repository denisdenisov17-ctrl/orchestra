package ru.poib.VTBHack.mapping.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Ребро графа потока данных между шагами процесса
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DataFlowEdge {
    private String sourceTaskId;
    private String targetTaskId;
    private List<String> fields; // Поля из response шага N, используемые в request шага N+1
    private double confidence; // Уверенность в определении потока данных
}


