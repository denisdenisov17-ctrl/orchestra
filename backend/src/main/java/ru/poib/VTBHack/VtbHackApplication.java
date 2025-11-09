package ru.poib.VTBHack;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.http.client.HttpClientAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.io.ClassPathResource;
import ru.poib.VTBHack.parser.model.openapi.OpenApiModel;
import ru.poib.VTBHack.parser.model.puml.SequenceDiagramModel;
import ru.poib.VTBHack.parser.model.puml.ValidationResult;
import ru.poib.VTBHack.mapping.model.MappingResult;
import ru.poib.VTBHack.mapping.service.MappingService;
import ru.poib.VTBHack.parser.model.ProcessModel;
import ru.poib.VTBHack.parser.service.BpmnParserService;
import ru.poib.VTBHack.parser.service.OpenApiParserService;
import ru.poib.VTBHack.parser.service.PlantUmlParserService;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Paths;

@SpringBootApplication(exclude = {HttpClientAutoConfiguration.class})
public class VtbHackApplication {

	public static void main(String[] args) {
		SpringApplication.run(VtbHackApplication.class);
//		ConfigurableApplicationContext context = SpringApplication.run(VtbHackApplication.class, args);

		// Временный код для тестирования
//        try {
//            testBpmnParser(context);
//			testPlantUmlParser(context);
//			testOpenApiParser(context);
//			testMappingModule(context);
//        } catch (IOException e) {
//            throw new RuntimeException(e);
//        }
    }

	private static void testOpenApiParser(ConfigurableApplicationContext context) {
        try {
            OpenApiParserService parserService = context.getBean(OpenApiParserService.class);

            // Test parsing from URL
            String apiUrl = "https://vbank.open.bankingapi.ru/openapi.json";
            System.out.println("\nTesting OpenAPI parser with URL: " + apiUrl);
            
            URL url = new URL(apiUrl);
            try (InputStream inputStream = url.openStream()) {
                OpenApiModel model = parserService.parseOpenApi(inputStream);
                
                System.out.println("✅ OpenAPI specification successfully parsed!");
                System.out.println("API Title: " + model.getInfo().getTitle());
                System.out.println("Version: " + model.getInfo().getVersion());
                System.out.println("OpenAPI Version: " + model.getOpenApiVersion());
                
                System.out.println("\nEndpoints:");
                model.getPaths().forEach((path, pathItem) -> {
                    System.out.println("Path: " + path);
                    if (pathItem.getGet() != null) {
                        System.out.println("  GET: " + pathItem.getGet().getSummary());
                    }
                    if (pathItem.getPost() != null) {
                        System.out.println("  POST: " + pathItem.getPost().getSummary());
                    }
                    if (pathItem.getPut() != null) {
                        System.out.println("  PUT: " + pathItem.getPut().getSummary());
                    }
                    if (pathItem.getDelete() != null) {
                        System.out.println("  DELETE: " + pathItem.getDelete().getSummary());
                    }
                });
            }
        } catch (Exception e) {
            System.err.println("❌ Error testing OpenAPI parser: " + e.getMessage());
            e.printStackTrace();
        }
    }

	private static void testBpmnParser(ConfigurableApplicationContext context) throws IOException {
		BpmnParserService parserService = context.getBean(BpmnParserService.class);

		String bpmnXml = Files.readString(Paths.get(new ClassPathResource("01_bonus_payment.bpmn").getURI()));

		try {
			var processModel = parserService.parse(bpmnXml);
			System.out.println("✅ Процесс успешно распарсен!");
			System.out.println("ID: " + processModel.getId());
			System.out.println("Имя: " + processModel.getName());
			System.out.println("Задачи:");
			processModel.getTasks().forEach(task -> {
				System.out.println("  - ID: " + task.getId() + ", Имя: " + task.getName() + ", Тип: " + task.getType());
				if (task.getApiEndpointInfo() != null) {
					System.out.println("    API: " + task.getApiEndpointInfo().getMethod() + " " + task.getApiEndpointInfo().getPath());
				}
			});
			System.out.println("Start Event: " + processModel.getStartEventName());
			System.out.println("End Event: " + processModel.getEndEventName());
		} catch (Exception e) {
			System.err.println("❌ Ошибка парсинга: " + e.getMessage());
			e.printStackTrace();
		}
	}

	private static void testPlantUmlParser(ConfigurableApplicationContext context) {
		try {
			// 1. Получаем сервис
			PlantUmlParserService parserService = context.getBean(PlantUmlParserService.class);

			String content = Files.readString(Paths.get(new ClassPathResource("02_credit_application.puml").getURI()));

			// 3. Парсим
			SequenceDiagramModel model = parserService.parse(content);
			System.out.println("✅ Диаграмма успешно распарсена!");
			System.out.println("Участники: " + model.getParticipants().size());
			System.out.println("Взаимодействий: " + model.getInteractions().size());

			// 4. Выводим API-эндпоинты
			var endpoints = parserService.extractApiEndpoints(content);
			System.out.println("\nAPI Endpoints:");
			endpoints.forEach(ep ->
					System.out.println("  " + ep.getMethod() + " " + ep.getPath() +
							" (" + ep.getSource() + " → " + ep.getTarget() + ")")
			);

			// 5. Валидация
			ValidationResult validation = parserService.validate(content);
			System.out.println("\nВалидация:");
			System.out.println("  Валиден: " + validation.isValid());
			if (!validation.getErrors().isEmpty()) {
				System.out.println("  Ошибки:");
				validation.getErrors().forEach(err -> System.out.println("    ❌ " + err));
			}
			if (!validation.getWarnings().isEmpty()) {
				System.out.println("  Предупреждения:");
				validation.getWarnings().forEach(warn -> System.out.println("    ⚠️ " + warn));
			}

			// 6. Статистика
			var stats = parserService.getStatistics(content);
			System.out.println("\nСтатистика:");
			System.out.println("  Участники: " + stats.getParticipantCount());
			System.out.println("  Взаимодействия: " + stats.getInteractionCount());
			System.out.println("  API вызовов: " + stats.getApiCallCount());
			System.out.println("  Методы: " + stats.getMethodDistribution());

		} catch (Exception e) {
			System.err.println("❌ Ошибка при тестировании PlantUML парсера:");
			e.printStackTrace();
		}
	}

	private static void testMappingModule(ConfigurableApplicationContext context) {
		try {
			System.out.println("\n=== Тестирование модуля сопоставления ===");
			
			BpmnParserService bpmnParser = context.getBean(BpmnParserService.class);
			OpenApiParserService openApiParser = context.getBean(OpenApiParserService.class);
			MappingService mappingService = context.getBean(MappingService.class);
			
			// Парсим BPMN
			String bpmnXml = Files.readString(Paths.get(new ClassPathResource("01_bonus_payment.bpmn").getURI()));
			ProcessModel processModel = bpmnParser.parse(bpmnXml);
			
			// Парсим OpenAPI
			String apiUrl = "https://vbank.open.bankingapi.ru/openapi.json";
			URL url = new URL(apiUrl);
			OpenApiModel openApiModel;
			try (InputStream inputStream = url.openStream()) {
				openApiModel = openApiParser.parseOpenApi(inputStream);
			}
			
			// Выполняем сопоставление
			long startTime = System.currentTimeMillis();
			MappingResult result = mappingService.mapProcessToEndpoints(processModel, openApiModel);
			long endTime = System.currentTimeMillis();
			
			System.out.println("✅ Сопоставление выполнено за " + (endTime - startTime) + " мс");
			System.out.println("\nРезультаты сопоставления:");
			System.out.println("  Всего задач: " + result.getTotalTasks());
			System.out.println("  Сопоставлено задач: " + result.getMatchedTasks());
			System.out.println("  Всего эндпоинтов: " + result.getTotalEndpoints());
			System.out.println("  Сопоставлено эндпоинтов: " + result.getMatchedEndpoints());
			System.out.println("  Общая уверенность: " + String.format("%.2f%%", result.getOverallConfidence() * 100));
			
			System.out.println("\nДетали сопоставления:");
			result.getTaskMappings().forEach((taskId, mapping) -> {
				System.out.println("  Задача: " + mapping.getTaskName() + " (ID: " + taskId + ")");
				System.out.println("    → Эндпоинт: " + mapping.getEndpointMethod() + " " + mapping.getEndpointPath());
				System.out.println("    Стратегия: " + mapping.getMatchingStrategy());
				System.out.println("    Уверенность: " + String.format("%.2f%%", mapping.getConfidenceScore() * 100));
				System.out.println("    Рекомендация: " + mapping.getRecommendation());
			});
			
			if (!result.getUnmatchedTasks().isEmpty()) {
				System.out.println("\nНесопоставленные задачи:");
				result.getUnmatchedTasks().forEach(unmatched -> {
					System.out.println("  - " + unmatched.getElementName() + " (ID: " + unmatched.getElementId() + ")");
					unmatched.getRecommendations().forEach(rec -> System.out.println("    💡 " + rec));
				});
			}
			
			if (!result.getDataFlowEdges().isEmpty()) {
				System.out.println("\nПоток данных:");
				result.getDataFlowEdges().forEach(edge -> {
					System.out.println("  " + edge.getSourceTaskId() + " → " + edge.getTargetTaskId());
					System.out.println("    Поля: " + String.join(", ", edge.getFields()));
					System.out.println("    Уверенность: " + String.format("%.2f%%", edge.getConfidence() * 100));
				});
			}
			
		} catch (Exception e) {
			System.err.println("❌ Ошибка при тестировании модуля сопоставления: " + e.getMessage());
			e.printStackTrace();
		}
	}
}
