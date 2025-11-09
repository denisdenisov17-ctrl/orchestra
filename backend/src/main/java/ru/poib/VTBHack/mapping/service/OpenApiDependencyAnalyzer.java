package ru.poib.VTBHack.mapping.service;

import org.springframework.stereotype.Service;
import ru.poib.VTBHack.parser.model.openapi.OpenApiModel;
import ru.poib.VTBHack.parser.model.openapi.Operation;
import ru.poib.VTBHack.parser.model.openapi.Parameter;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Анализирует описания полей OpenAPI и извлекает зависимости вида
 * «подставить ответ из METHOD /path», чтобы можно было построить поток данных.
 */
@Service
public class OpenApiDependencyAnalyzer {

    // Ищем явные упоминания HTTP-метода и пути
    private static final Pattern ENDPOINT_PATTERN = Pattern.compile("(?i)(GET|POST|PUT|DELETE)\\s+(/[-\\w{}./]+)");
    // Подсказки, что это именно зависимость (а не просто упоминание)
    private static final Pattern DEP_HINT_PATTERN = Pattern.compile("(?iu)(подставить|возьмите|используйте|из ответа|response of)");
    // Эвристика извлечения имени поля рядом с упоминанием
    private static final Pattern FIELD_HINT_PATTERN = Pattern.compile("(?iu)(поле|field|значение|token|id|identifier)[:\n\r\s]*([A-Za-z0-9_.-]+)");

    /**
     * Возвращает зависимости: для каждой операции список эндпоинтов, из ответа которых нужно подставить данные
     * Ключ: method:path текущей операции. Значение: список зависимых эндпоинтов с полем-подсказкой, если найдено.
     */
    public Map<String, List<OpenApiDependency>> analyze(OpenApiModel openApiModel) {
        Map<String, List<OpenApiDependency>> result = new HashMap<>();

        if (openApiModel == null || openApiModel.getPaths() == null) {
            return result;
        }

        openApiModel.getPaths().forEach((path, pathItem) -> {
            if (pathItem == null) return;
            analyzeOperation(result, "GET", path, pathItem.getGet());
            analyzeOperation(result, "POST", path, pathItem.getPost());
            analyzeOperation(result, "PUT", path, pathItem.getPut());
            analyzeOperation(result, "DELETE", path, pathItem.getDelete());
        });

        return result;
    }

    private void analyzeOperation(Map<String, List<OpenApiDependency>> acc,
                                  String method,
                                  String path,
                                  Operation op) {
        if (op == null) return;
        String key = method + ":" + path;
        List<String> texts = new ArrayList<>();

        if (op.getDescription() != null) texts.add(op.getDescription());
        if (op.getSummary() != null) texts.add(op.getSummary());

        if (op.getParameters() != null) {
            for (Parameter p : op.getParameters()) {
                if (p.getDescription() != null) texts.add(p.getDescription());
                if (p.getSchema() != null && p.getSchema().getDescription() != null) {
                    texts.add(p.getSchema().getDescription());
                }
            }
        }

        // Сканируем тексты на зависимости
        List<OpenApiDependency> deps = new ArrayList<>();
        for (String t : texts) {
            if (t == null || t.isBlank()) continue;
            Matcher hint = DEP_HINT_PATTERN.matcher(t);
            boolean isDependenceText = hint.find();

            Matcher m = ENDPOINT_PATTERN.matcher(t);
            while (m.find()) {
                String depMethod = m.group(1).toUpperCase(Locale.ROOT);
                String depPath = m.group(2);
                String fieldHint = null;
                Matcher fh = FIELD_HINT_PATTERN.matcher(t);
                if (fh.find()) {
                    fieldHint = fh.group(2);
                }

                // Если найдено упоминание эндпоинта и текст содержит подсказку зависимости — добавляем с высокой уверенностью
                // Иначе — добавляем с базовой уверенностью как эвристику
                double confidence = isDependenceText ? 0.8 : 0.5;
                deps.add(new OpenApiDependency(depMethod, depPath, fieldHint, confidence));
            }
        }

        if (!deps.isEmpty()) {
            acc.computeIfAbsent(key, k -> new ArrayList<>()).addAll(deps);
        }
    }

    /**
     * Модель зависимости текущего эндпоинта от другого эндпоинта (для подстановки ответа)
     */
    public static class OpenApiDependency {
        public final String method;
        public final String path;
        public final String fieldHint; // например, token или id
        public final double confidence;

        public OpenApiDependency(String method, String path, String fieldHint, double confidence) {
            this.method = method;
            this.path = path;
            this.fieldHint = fieldHint;
            this.confidence = confidence;
        }
    }
}