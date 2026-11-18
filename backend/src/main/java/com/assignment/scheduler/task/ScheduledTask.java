package com.assignment.scheduler.task;

import java.util.List;

/**
 * A predefined, read-only task that can be scheduled. Implementations are Spring beans discovered by
 * {@link TaskRegistry}; there is intentionally no way to create or modify tasks at runtime.
 */
public interface ScheduledTask {

	/** Stable identifier persisted on schedulings, e.g. {@code LOG}. */
	String key();

	String name();

	String description();

	List<ParameterDefinition> parameters();

	/** Runs the task. Parameters have already been validated against {@link #parameters()}. */
	void execute(TaskContext context) throws Exception;
}
