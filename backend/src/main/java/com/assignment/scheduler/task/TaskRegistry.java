package com.assignment.scheduler.task;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

/**
 * Catalog of all predefined tasks, built once at startup from the {@link ScheduledTask} beans.
 */
@Component
public class TaskRegistry {

	private final Map<String, ScheduledTask> tasksByKey;

	private final List<ScheduledTask> orderedTasks;

	public TaskRegistry(List<ScheduledTask> tasks) {
		Map<String, ScheduledTask> byKey = new LinkedHashMap<>();
		tasks.stream().sorted(Comparator.comparing(ScheduledTask::name)).forEach(task -> {
			if (byKey.putIfAbsent(task.key(), task) != null) {
				throw new IllegalStateException("Duplicate task key: " + task.key());
			}
		});
		this.tasksByKey = Map.copyOf(byKey);
		this.orderedTasks = List.copyOf(byKey.values());
	}

	/** All tasks, sorted by display name. */
	public List<ScheduledTask> all() {
		return orderedTasks;
	}

	public Optional<ScheduledTask> find(String key) {
		return key == null ? Optional.empty() : Optional.ofNullable(tasksByKey.get(key));
	}
}
