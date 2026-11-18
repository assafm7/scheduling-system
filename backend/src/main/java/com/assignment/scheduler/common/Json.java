package com.assignment.scheduler.common;

import java.util.Map;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Shared JSON mapper for values stored as JSON text (entity columns, Quartz job data). Used where Spring's
 * injected mapper is not reachable, such as JPA attribute converters.
 */
public final class Json {

	private static final JsonMapper MAPPER = JsonMapper.builder().build();

	private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
	};

	private Json() {
	}

	public static String write(Object value) {
		return MAPPER.writeValueAsString(value);
	}

	public static <T> T read(String json, Class<T> type) {
		return MAPPER.readValue(json, type);
	}

	public static Map<String, Object> readMap(String json) {
		return json == null || json.isBlank() ? Map.of() : MAPPER.readValue(json, MAP_TYPE);
	}
}
