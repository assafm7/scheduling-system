package com.assignment.scheduler.common;

import java.util.Map;

/**
 * Domain validation failure with field-keyed messages (e.g. {@code parameters.message -> "is required"}),
 * rendered as a 400 ProblemDetail so the UI can attach each message to its form field.
 */
public class ValidationException extends RuntimeException {

	private final Map<String, String> errors;

	public ValidationException(Map<String, String> errors) {
		super("Validation failed: " + errors.keySet());
		this.errors = Map.copyOf(errors);
	}

	public static ValidationException of(String field, String message) {
		return new ValidationException(Map.of(field, message));
	}

	public Map<String, String> getErrors() {
		return errors;
	}
}
