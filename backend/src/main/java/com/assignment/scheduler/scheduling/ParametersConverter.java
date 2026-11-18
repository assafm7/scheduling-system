package com.assignment.scheduler.scheduling;

import java.util.Map;

import com.assignment.scheduler.common.Json;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ParametersConverter implements AttributeConverter<Map<String, Object>, String> {

	@Override
	public String convertToDatabaseColumn(Map<String, Object> attribute) {
		return Json.write(attribute == null ? Map.of() : attribute);
	}

	@Override
	public Map<String, Object> convertToEntityAttribute(String dbData) {
		return Json.readMap(dbData);
	}
}
