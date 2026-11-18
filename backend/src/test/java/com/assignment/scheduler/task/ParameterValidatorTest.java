package com.assignment.scheduler.task;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class ParameterValidatorTest {

	private final ParameterValidator validator = new ParameterValidator();

	private final ScheduledTask task = new StubTask(List.of(
			ParameterDefinition.text("title", "Title", true, 5, null),
			ParameterDefinition.email("to", "To", false, null),
			ParameterDefinition.number("count", "Count", false, null),
			ParameterDefinition.bool("urgent", "Urgent", false, null),
			ParameterDefinition.choice("level", "Level", false, List.of("LOW", "HIGH"), null)));

	@Test
	void normalizesValidValues() {
		Map<String, String> errors = new LinkedHashMap<>();

		Map<String, Object> result = validator.validate(task,
				Map.of("title", "  abc ", "to", "a@b.io", "count", "42", "urgent", "true", "level", "HIGH"), errors);

		assertThat(errors).isEmpty();
		assertThat(result).containsEntry("title", "abc")
			.containsEntry("to", "a@b.io")
			.containsEntry("count", new BigDecimal("42"))
			.containsEntry("urgent", true)
			.containsEntry("level", "HIGH");
	}

	@Test
	void keepsNativeJsonTypes() {
		Map<String, String> errors = new LinkedHashMap<>();

		Map<String, Object> result = validator.validate(task, Map.of("title", "x", "count", 7, "urgent", false), errors);

		assertThat(errors).isEmpty();
		assertThat(result).containsEntry("count", 7).containsEntry("urgent", false);
	}

	@Test
	void dropsBlankOptionalValues() {
		Map<String, String> errors = new LinkedHashMap<>();
		Map<String, Object> raw = new HashMap<>();
		raw.put("title", "x");
		raw.put("to", "   ");
		raw.put("count", null);

		Map<String, Object> result = validator.validate(task, raw, errors);

		assertThat(errors).isEmpty();
		assertThat(result).containsOnlyKeys("title");
	}

	@Test
	void treatsNullValuesAsEmpty() {
		Map<String, String> errors = new LinkedHashMap<>();

		validator.validate(task, null, errors);

		assertThat(errors).containsExactly(Map.entry("parameters.title", "is required"));
	}

	@Test
	void rejectsUnknownParameters() {
		Map<String, String> errors = new LinkedHashMap<>();

		validator.validate(task, Map.of("title", "x", "hack", "1"), errors);

		assertThat(errors).containsEntry("parameters.hack", "is not a parameter of task STUB");
	}

	@ParameterizedTest(name = "{0}={1} -> {2}")
	@MethodSource("invalidValues")
	void reportsTypeErrors(String name, Object value, String expectedMessage) {
		Map<String, String> errors = new LinkedHashMap<>();
		Map<String, Object> values = new HashMap<>(Map.of("title", "ok"));
		values.put(name, value);

		validator.validate(task, values, errors);

		assertThat(errors).containsEntry("parameters." + name, expectedMessage);
	}

	static List<Arguments> invalidValues() {
		return List.of(
				Arguments.of("title", "toolong", "must be at most 5 characters"),
				Arguments.of("title", 12, "must be text"),
				Arguments.of("to", "not-an-email", "must be a valid email address"),
				Arguments.of("count", "abc", "must be a number"),
				Arguments.of("count", Double.NaN, "must be a number"),
				Arguments.of("urgent", "yes", "must be true or false"),
				Arguments.of("level", "MEDIUM", "must be one of: LOW, HIGH"));
	}

	@Test
	void capsTextWithoutExplicitMaxLength() {
		ScheduledTask unbounded = new StubTask(
				List.of(new ParameterDefinition("note", "Note", ParameterType.STRING, true, null, null, null)));
		Map<String, String> errors = new LinkedHashMap<>();

		validator.validate(unbounded, Map.of("note", "x".repeat(ParameterDefinition.DEFAULT_MAX_LENGTH + 1)), errors);

		assertThat(errors).containsKey("parameters.note");
	}

	record StubTask(List<ParameterDefinition> parameters) implements ScheduledTask {

		@Override
		public String key() {
			return "STUB";
		}

		@Override
		public String name() {
			return "Stub";
		}

		@Override
		public String description() {
			return "";
		}

		@Override
		public void execute(TaskContext context) {
		}
	}
}
