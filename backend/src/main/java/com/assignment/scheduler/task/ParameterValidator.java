package com.assignment.scheduler.task;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

/**
 * Validates and normalizes parameter values against a task's schema. Errors are keyed as
 * {@code parameters.<name>} so they map directly onto the UI's form fields.
 */
@Component
public class ParameterValidator {

	private static final String FIELD_PREFIX = "parameters.";

	private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

	/**
	 * @param errors receives one message per invalid field
	 * @return the normalized values (trimmed strings, parsed numbers/booleans); blank optional values are dropped
	 */
	public Map<String, Object> validate(ScheduledTask task, Map<String, Object> rawValues, Map<String, String> errors) {
		Map<String, Object> values = rawValues == null ? Map.of() : rawValues;
		Map<String, Object> normalized = new LinkedHashMap<>();

		Set<String> known = task.parameters().stream().map(ParameterDefinition::name).collect(Collectors.toSet());
		values.keySet().stream()
			.filter(name -> !known.contains(name))
			.forEach(name -> errors.put(FIELD_PREFIX + name, "is not a parameter of task " + task.key()));

		for (ParameterDefinition definition : task.parameters()) {
			Object raw = values.get(definition.name());
			if (isBlank(raw)) {
				if (definition.required()) {
					errors.put(FIELD_PREFIX + definition.name(), "is required");
				}
				continue;
			}
			try {
				normalized.put(definition.name(), normalize(definition, raw));
			}
			catch (IllegalArgumentException ex) {
				errors.put(FIELD_PREFIX + definition.name(), ex.getMessage());
			}
		}
		return normalized;
	}

	private static Object normalize(ParameterDefinition definition, Object raw) {
		return switch (definition.type()) {
			case STRING -> text(definition, raw);
			case EMAIL -> {
				String email = text(definition, raw);
				if (!EMAIL.matcher(email).matches()) {
					throw new IllegalArgumentException("must be a valid email address");
				}
				yield email;
			}
			case NUMBER -> number(raw);
			case BOOLEAN -> bool(raw);
			case ENUM -> {
				String value = text(definition, raw);
				if (definition.options() == null || !definition.options().contains(value)) {
					throw new IllegalArgumentException("must be one of: " + String.join(", ", definition.options()));
				}
				yield value;
			}
		};
	}

	private static String text(ParameterDefinition definition, Object raw) {
		if (!(raw instanceof String s)) {
			throw new IllegalArgumentException("must be text");
		}
		String value = s.strip();
		if (value.length() > definition.effectiveMaxLength()) {
			throw new IllegalArgumentException("must be at most " + definition.effectiveMaxLength() + " characters");
		}
		return value;
	}

	private static Number number(Object raw) {
		if (raw instanceof Number n && !(n instanceof Double d && (d.isNaN() || d.isInfinite()))) {
			return n;
		}
		if (raw instanceof String s) {
			try {
				return new BigDecimal(s.strip());
			}
			catch (NumberFormatException ignored) {
				// fall through to the error below
			}
		}
		throw new IllegalArgumentException("must be a number");
	}

	private static Boolean bool(Object raw) {
		if (raw instanceof Boolean b) {
			return b;
		}
		if (raw instanceof String s && (s.equalsIgnoreCase("true") || s.equalsIgnoreCase("false"))) {
			return Boolean.valueOf(s);
		}
		throw new IllegalArgumentException("must be true or false");
	}

	private static boolean isBlank(Object raw) {
		return raw == null || (raw instanceof String s && s.isBlank());
	}
}
