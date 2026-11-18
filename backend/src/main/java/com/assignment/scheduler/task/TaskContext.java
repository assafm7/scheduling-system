package com.assignment.scheduler.task;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Everything a task receives when it is executed: the owning scheduling and its validated parameter values.
 */
public record TaskContext(UUID schedulingId, Map<String, Object> parameters) {

	public TaskContext {
		parameters = parameters == null ? Map.of() : Map.copyOf(parameters);
	}

	public Optional<String> getString(String name) {
		return Optional.ofNullable(parameters.get(name)).map(String::valueOf);
	}

	public String requireString(String name) {
		return getString(name).orElseThrow(() -> new IllegalArgumentException("Missing parameter: " + name));
	}
}
