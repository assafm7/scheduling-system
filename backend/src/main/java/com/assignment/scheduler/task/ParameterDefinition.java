package com.assignment.scheduler.task;

import java.util.List;

/**
 * Schema of a single task parameter. Drives both the dynamic form in the UI and server-side validation.
 */
public record ParameterDefinition(
		String name,
		String label,
		ParameterType type,
		boolean required,
		String description,
		List<String> options,
		Integer maxLength) {

	/** Upper bound applied to every text value, even when the definition sets no explicit maxLength. */
	public static final int DEFAULT_MAX_LENGTH = 2000;

	public static ParameterDefinition text(String name, String label, boolean required, int maxLength, String description) {
		return new ParameterDefinition(name, label, ParameterType.STRING, required, description, null, maxLength);
	}

	public static ParameterDefinition email(String name, String label, boolean required, String description) {
		return new ParameterDefinition(name, label, ParameterType.EMAIL, required, description, null, 254);
	}

	public static ParameterDefinition number(String name, String label, boolean required, String description) {
		return new ParameterDefinition(name, label, ParameterType.NUMBER, required, description, null, null);
	}

	public static ParameterDefinition bool(String name, String label, boolean required, String description) {
		return new ParameterDefinition(name, label, ParameterType.BOOLEAN, required, description, null, null);
	}

	public static ParameterDefinition choice(String name, String label, boolean required, List<String> options,
			String description) {
		return new ParameterDefinition(name, label, ParameterType.ENUM, required, description, List.copyOf(options), null);
	}

	public int effectiveMaxLength() {
		return maxLength != null ? Math.min(maxLength, DEFAULT_MAX_LENGTH) : DEFAULT_MAX_LENGTH;
	}
}
