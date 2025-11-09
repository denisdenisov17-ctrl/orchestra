package ru.poib.VTBHack.mapping.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.poib.VTBHack.mapping.model.MappingResult;
import ru.poib.VTBHack.mapping.service.MappingService;
import ru.poib.VTBHack.parser.model.ProcessModel;
import ru.poib.VTBHack.parser.model.openapi.OpenApiModel;
import ru.poib.VTBHack.parser.service.BpmnParserService;
import ru.poib.VTBHack.parser.service.OpenApiParserService;

/**
 * REST контроллер для модуля сопоставления
 */
@RestController
@RequestMapping("/api/mapping")
@CrossOrigin(origins = "*")
public class MappingController {
    
    private final MappingService mappingService;
    private final BpmnParserService bpmnParserService;
    private final OpenApiParserService openApiParserService;
    
    public MappingController(MappingService mappingService,
                             BpmnParserService bpmnParserService,
                             OpenApiParserService openApiParserService) {
        this.mappingService = mappingService;
        this.bpmnParserService = bpmnParserService;
        this.openApiParserService = openApiParserService;
    }
    
    /**
     * Сопоставляет BPMN процесс с OpenAPI спецификацией
     */
    @PostMapping("/map")
    public ResponseEntity<MappingResult> mapProcessToApi(
            @RequestParam String bpmnXml,
            @RequestParam String openApiJson) {
        try {
            ProcessModel processModel = bpmnParserService.parse(bpmnXml);
            OpenApiModel openApiModel = openApiParserService.parseOpenApi(openApiJson);
            
            MappingResult result = mappingService.mapProcessToEndpoints(processModel, openApiModel);
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Получает рекомендации для несопоставленных задач
     * Использует POST метод для поддержки больших BPMN и OpenAPI файлов
     */
    @PostMapping("/recommendations")
    public ResponseEntity<MappingResult> getRecommendations(
            @RequestParam String bpmnXml,
            @RequestParam String openApiJson) {
        try {
            ProcessModel processModel = bpmnParserService.parse(bpmnXml);
            OpenApiModel openApiModel = openApiParserService.parseOpenApi(openApiJson);

            MappingResult result = mappingService.mapProcessToEndpoints(processModel, openApiModel);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}


